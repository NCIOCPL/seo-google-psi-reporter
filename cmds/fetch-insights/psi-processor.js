const {default: PQueue} = require('p-queue');

/**
 * Class to process PSI requests, throttled to API limits.
 */
class PsiProcessor {

  /**
   * Creates an instance of a PSI Queue.
   *
   * REMINDER: There is a total daily limit of 25,000 requests.
   *
   * NOTE: interval and intervalCap defaults are set to PSI quotas. Also note that Google will hit your website if it does
   * not have the information, so if the web site will not handle 400 Requests / 100 sec with 5 max concurrent
   * requests at a time, you will need to lower those values to something your web server can handle. 
   * 
   * @param {PsiUrlFetcher} psiFetcher 
   * @param {Object} queueOptions
   * @param {number} queueOptions.maxConcurrent max concurrent requests. This should match your HTTPS agent. (Default: 5)
   * @param {number} queueOptions.timeout request timeout. This should match your HTTPS agent. (Default: 30000)
   * @param {number} queueOptions.interval length of time in ms before interval count resets. (Default: 100000)
   * @param {number} queueOptions.intervalCap max number of runs for the given interval. (Default: 400)
   */
  constructor(psiFetcher, {
    maxConcurrent = 5,
    timeout = 30000,
    interval = 100000,
    intervalCap = 400
  } = {}) {

    if (psiFetcher === null) {
      throw new Error('Psi URL Fetcher is required.');
    }

    this.fetcher = psiFetcher;

    // PSI currently has a 400 req/100 seconds
    // Max 25,000 req/day resetting at 3am Eastern time
    this.queue = new PQueue({
      concurrency: maxConcurrent,
      timeout,
      interval,
      intervalCap,
      carryoverConcurrencyCount: true
    })
  }

  /**
   * Process a group of items. We do not want to blow up our memory, so
   * we would want to process a limited amount of items.
   * @param {Array} items 
   */
  async processGroup(items) {
    const results = {
      successes: [],
      failures: []
    };

    // Enqueue Items. This will push each URL result into the results array
    for (let i=0; i<items.length; i++) {
      const item = items[i];
      this.queue.add(async () => {

        try {
          const res = await this.fetcher.fetch(item.url, { strategy: item.strategy });
          results.successes.push({
            item,
            report: res
          });
        } catch (err) {
          // - Requeuing here will allow this class to deal with errors, and only
          // fail the batch if non-recoverable.
          //
          // - Returning an error back to the main process, and having it handle
          // the requeue allows us to have a higher throughput overall as a requeue
          // here will reduce the concurrent async activities. (Since the main
          // process is going to wait for this to finish before handing requests
          // off to the save portion.)
          //
          // Whatever the case may be, we should not throw as that will crash
          // everything.
          results.failures.push({
            item,
            error: err
          })
        }
      });
    }

    // Wait for current batch to process
    await this.queue.onIdle();

    return results;
  }

}

module.exports = PsiProcessor;