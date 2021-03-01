const path = require('path');

const { Command } = require('commander');
const HttpsAgent = require('agentkeepalive').HttpsAgent;
const mkdirp = require('mkdirp');

const Fetcher = require('./fetcher');
const PsiProcessor = require('./psi-processor');
const PsiUrlFetcher = require('./psi-url-fetcher');
const QueueStorage = require('./queue-storage');
const SitemapScraper = require('./sitemap-scraper');
const PageTypeFetcher = require('./page-type-fetcher');

const { pad, replaceHomeDir } = require('./util');

/**
 * Function to get the Commander command to register with program.
 */
const FetchInsights = () => {
  const command = new Command('fetch-insights');
  command
    .version('2.0.0')
    .requiredOption('-h,--hostname <hostname>', 'must specify hostname')
    .requiredOption('-k,--apikey <apikey>', 'must specify apikey')
    .option('-b,--batch-size [batchSize]', 'The batchsize for each fetching round. This is roughly how many PSI documents to hold in memory before flushing to storage.', 20)
    .option('-s,--sitemap [sitemap]', 'the path to the sitemap', '/sitemap.xml')
    .option('-q,--queue-data-directory [queueDataDirectory]', 'the queue directory', './data')
    .option('-r,--max-concurrent-requests [maxConcurrentRequests]', 'the maximum number of concurrent https requests (per host)', 10)
    .option('-r,--max-requests-per-second [maxRequestsPerSecond]', 'the maximum number of https requests per second. This should be set to the lowest allowed value in the chain. (i.e. less than the Akamai rules for prodction.)', 40)
    .option('-t,--request-timeout [requestTimeout]', 'the https request timeout (in ms)', 30000)
    .description(`
      Using a website\'s sitemap.xml, this tool calls the Google PSI API to get page speed reports and
      places the results in the configured storage.
    `)
    .action(async ({
      hostname,
      apikey,
      batchSize,
      maxConcurrentRequests,
      maxRequestsPerSecond,
      requestTimeout,
      queueDataDirectory,
      sitemap,
      ...rest
    } = {}, cmd) => {
      // The idea behind this code here is to setup all the processors,
      // scrapers, etc with all the right settings. This will allow our
      // fetcher to be "easily" tested as we only have to mock the
      // methods, not network responses and other things like that.

      // Ensure that process.exit is called when various signals are
      // caught.
      process.on('SIGHUP', () => process.exit(128 + 1));
      process.on('SIGINT', () => process.exit(128 + 2));
      process.on('SIGTERM', () => process.exit(128 + 15));

      // You want to setup the network request mocks in the tests for
      // the places that actually make the requests.

      // TODO: Make this a little cleaner
      const sitemapUrl = hostname + sitemap;

      // Initialize Agent Keep Alive. So this has sockets per host, and
      // a socket stays active after use for 4 minutes, and MacOS, the
      // worst case scenario only allows 256 handles open for a process
      // by default. So you want to set this number to a low enough
      // value, say 10, which, if we have to go to 5 hosts and do a lot
      // of processing we will only use 50 sockets. Note disk IO also
      // counts to your active handles.
      const keepAliveConfig = {
        maxSockets: maxConcurrentRequests, // This is per host!
        timeout: requestTimeout
      };
      const httpsKeepAliveAgent = new HttpsAgent(keepAliveConfig);
    
      // Next we want to setup our PSI Processor here.
      // Create an instance of the class responsible for fetching
      // the PSI report.
      const psiFetcher = new PsiUrlFetcher({ agent: httpsKeepAliveAgent, apikey });

      // Create the psiProcessor. We will keep the default interval and intervalCap
      // to match 
      const psiProcessor = new PsiProcessor(psiFetcher, {
        maxRequestsPerSecond,
        maxConcurrent: maxConcurrentRequests,
        timeout: requestTimeout
      })

      // Create the Sitemap Scraper.
      const sitemapScraper = new SitemapScraper({ 
        intervalCap: maxRequestsPerSecond,
        agent: httpsKeepAliveAgent
      });

      // Create the type fetcher
      const pageTypeFetcher = new PageTypeFetcher({
        agent: httpsKeepAliveAgent,
        intervalCap: maxRequestsPerSecond,
      });

      // Create, or open the queue database
      // So our approach for now, in order to limit the data,
      // is to keep only a single day in the queue, so name
      // it with a time stamp.
      const now = new Date();
      const [year, month, day] = [
        now.getFullYear(),
        pad(now.getMonth()),
        pad(now.getDay()),
      ];

      // Setup the filename.
      const queueFileName = `Psi-Report_${year}-${month}-${day}.db`;

      const resolvedQueuePath = path.resolve(replaceHomeDir(queueDataDirectory));

      try {
        await mkdirp(resolvedQueuePath);
      } catch (err) {
        console.error(`Could not create data folder ${resolvedQueuePath}`);
        process.exit(2);
      }

      const fullQueuePath = path.join(
        resolvedQueuePath,
        queueFileName
      );

      // Create the instance.
      let queueStorage;

      try {
        queueStorage = new QueueStorage(fullQueuePath);

        // Ensure we close the storage on exit.
        process.on('exit', () => queueStorage.close());
      } catch (err) {
        console.error(err);
        process.exit(1);
      }


      const fetcher = new Fetcher(
        psiProcessor, 
        sitemapScraper,
        pageTypeFetcher,
        queueStorage,
        {
          batchSize
        }
      );

      await fetcher.fetch(sitemapUrl);

      process.exit(0);
    });
  return command;
}

module.exports = FetchInsights;