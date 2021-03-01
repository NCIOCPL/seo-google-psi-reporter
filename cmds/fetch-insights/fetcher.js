const pSeries = require('p-series');
const PageTypeFetcher = require('./page-type-fetcher');
const { batchArray } = require('./util');


/**
 * Class representing the main ETL process.
 */
class Fetcher {

  /**
   * Creates a new instance of the main Fetcher.
   * @param {PsiProcessor} psiProcessor The PageSpeed Insights Processor
   * @param {SitemapScraper} sitemapScraper The Sitemap Scraper
   * @param {PageTypeFetcher} pageTypeFetcher The Page Type Fetcher
   * @param {QueueStorage} queueStorage The Queue Storage
   * @param {Object} options Options for the processor
   */
  constructor(
    psiProcessor,
    sitemapScraper,
    pageTypeFetcher,
    queueStorage,
    {
      batchSize = 20,
    } = {}
  ) {

    if (psiProcessor === null) {
      throw new Error('Must supply a valid PageSpeed Inights Processor.');
    }
    this.psiProcessor = psiProcessor;

    if (sitemapScraper === null) {
      throw new Error('You must supply a valid Sitemap Scraper');
    }
    this.sitemapScraper = sitemapScraper;

    if (pageTypeFetcher === null) {
      throw new Error('You must supply a valid Page Type Fetcher');
    }
    this.pageTypeFetcher = pageTypeFetcher;

    if (queueStorage === null) {
      throw new Error('You must supply a valid Queue Storage');
    }
    this.queueStorage = queueStorage;

    this.batchSize = batchSize;
  }

  /**
   * Processes a batch.
   * @param {*} batch 
   */
  async processBatchGroup(batch) {

    // NOTE: This should NEVER THROW.

    // Mark all the items as processing.
    for (const { id } of batch) {
      this.queueStorage.updateStatus(id, 'PROCESSING');
    }

    // A result will look like the PSI item, plus a report.
    const results = await this.psiProcessor.processGroup(batch);

    // Update the status of successful fetches.
    for (const {item, report} of results.successes) {
      this.queueStorage.updateStatus(item.id, 'FETCHED', null, report);
    }

    // Update the status of failed fetches.
    for (const {item, error} of results.failures) {
      // We should investigate the errors to determine if the item should be
      // requeued or not.
      this.queueStorage.updateStatus(item.id, 'FAILED', error.message, null);
    }

    // TODO: Push to ES (for successes)

    // TODO: Determine if we should continue. In the event of an error that
    // we will continue to get, there is no need in processing thousands of
    // items, e.g. the API key is not valid...
 
    return true;
  }

  /**
   * Async Generator to Manage Queue Processing.
   */
  async *queueProcessor() {
    let items = this.queueStorage.getQueueItems({ status: 'QUEUED', limit: this.batchSize });
    let okToContinue = true;

    while (items.length > 0 && okToContinue) {
      // Process the nexit batch of items
      okToContinue = await this.processBatchGroup(items);

      // This yields control back to the for await loop. We will just return items processed.
      const itemsProcessed = items.length;
      yield itemsProcessed;

      items = this.queueStorage.getQueueItems({ status: 'QUEUED', limit: this.batchSize });
    }
  }

  /**
   * This is the main fetcher.
   * @param {string} sitemapUrl - the sitemap url    
   */
  async fetch(sitemapUrl) {

    // Step 1. Fetch the sitemap.xml
    const validContentTypeRegex = /^text\/html/i;

    let siteMapUrls;
    try {
      siteMapUrls = await this.sitemapScraper.fetch(sitemapUrl);
    } catch (err) {
      console.error(`Could not fetch sitemap ${sitemapUrl}`);
      throw err;
    }

    // The next bit of logic prevents us from refetching page information
    // from a previous run we are continuing. That job could have failed
    // due to too many issues, OR a bug in code, or even someone just
    // stopped it. 

    // Get the URLs in the queue. Turn it into a map.
    const existingQueue = this.queueStorage.getQueueItems()
      .reduce((ac,curr) => {
        return {
          ...ac,
          [curr.url]: true
        }
      }, {});

    // Get ignore urls, turn into a map
    const ignoreUrls = this.queueStorage.getIgnoreUrls()
      .reduce((ac,curr) => {
        return {
          ...ac,
          [curr.url]: true
        }
      }, {});

    // Remove the urls from the list of things to fetch page types for if
    // it is already queued OR it is something that should be ignored.
    // Using the reduces above allows us to make the filter test simpler.
    const pagesToFetchTypes = siteMapUrls.filter(url => (!existingQueue[url] && !ignoreUrls[url]));
    const potentialUrls = await this.pageTypeFetcher.fetch(pagesToFetchTypes);

    // TODO: What do we do with enqueued or ignored urls no longer in the sitemap??
    // For now, we don't care since we will do the DB daily.

    // So we now want to take the page fetcher results and make the ignoreUrls
    const ignoreUrlsToAdd = potentialUrls.filter(urlinfo => urlinfo.status != 200 || !urlinfo.contenttype.match(validContentTypeRegex));
    this.queueStorage.addIgnoreUrls(ignoreUrlsToAdd);

    // Process the URLs to only get those that are HTML pages with a 200 response.
    // We will also get the other info for metrics to display at the end.
    const urlsToEnqueue = potentialUrls.filter(urlinfo => urlinfo.status === 200 && urlinfo.contenttype.match(validContentTypeRegex));

    // Turn each url into 2 PSI fetch items for the two PSI strategies
    const psiStrategies = ['DESKTOP', 'MOBILE'];
    const itemsToEnqueue = urlsToEnqueue
      .reduce((ac, urlinfo) => ([
        ...ac,
        ...(psiStrategies.map(strategy => ({ url: urlinfo.url, strategy})))
      ]), []);

      // Enqueue the items in the queue.
    this.queueStorage.enqueueItems(itemsToEnqueue);

    // Iterate through batches until there are no more items to
    // process.
    for await(const itemsProcessed of this.queueProcessor()) {
      console.log(`Processed ${itemsProcessed} items.`);
    }

    const processedItems = this.queueStorage.getQueueItems();

    // Output a report.
//     console.log(`
// Finished Processing ${urls.length} URLs from Sitemap.xml.
//   Valid HTML Sitemap Urls: ${goodUrls.length}
//     Items Successfully Fetched: TBD
//     Failed Items: TBD
//   Non-HTML Sitemap Urls: ${nonHtmlUrls.length}
//   Invalid Sitemap Urls: ${badUrls.length} 
//     `);
  }
}

module.exports = Fetcher;