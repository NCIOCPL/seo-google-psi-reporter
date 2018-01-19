'use strict';

const Promise         = require('bluebird');
const _               = require('lodash');
const async           = require('async');
const fs              = require('fs');
const fsp             = Promise.promisifyAll(require('fs'));
const Logger          = require('./logger');
const limit           = require('simple-rate-limiter');
const retry           = require('bluebird-retry');
const path            = require('path');
const psi             = require('psi');
const rp              = require('request-promise');
const Sitemapper      = require('sitemapper');
const uuidV4          = require('uuid/v4');

/**
 * Defines throttled function to fetch results.
 */
var getPSI = limit(function(url, psiOpt, logger, callback) {
  logger.info(`Fetching ${url} for ${psiOpt.strategy}`);

  psi(url, psiOpt)
  .then((res) => { //If succeeded, then call our callback
    logger.debug(`Finished Fetching ${url} for ${psiOpt.strategy}.`);  
    callback(null,res);
  }).catch((err) => { //If failed, then call the callback with an error.
    logger.error(`Err Fetching ${url} for ${psiOpt.strategy}. ${err}`);
    callback(err, null);
  });
}).to(1).per(2000);


/**
 * Class that is used to extract a sitemap.xml and get page speed insights for those URLs
 */
class InsightsProcessor {

  /**
   * Creates a new instance of the InsightsProcessor
   * @param {*} server 
   * @param {*} storageProvider An instance of a Storage Provider class for storing the PSI information.
   * @param {*} options 
   */
  constructor(logger, server, storageProvider, options) {
    this.logger = logger;
    this.server = server;
    this.storageProvider = storageProvider;
    this.apiKey = options.insightsApiKey;
    // This is how many URLs to query google at once.  Note: 2 strategies means batch_size * 2 req/batch
    this.psi_batch_size = options.psi_batch_size;
    this.psi_batch_sleep = options.psi_batch_sleep;
    // This is how many urls to take at a time
    this.psi_max_async = options.psi_max_async;
    this.logger.info(`Using Key: ${this.apiKey}`);

    //Counter for status
    this.processedItems = 0;

    //Counter for fetchedItems.
    this.fetchedItems = 0;

    //Count errors
    this.errorCount = 0;
  }

  /**
   * 
   * @param {*} folderPath 
   * @param {*} filename 
   * @param {*} data 
   */
  _saveFile(folderPath, filename, data) {
    let filePath = path.join(folderPath, filename);
    return fsp.writeFileAsync(filePath, JSON.stringify(data), 'utf8');
  }


  /**
   * Creates all the folders to a results group.
   * For example content id 1234564-11222-2222-222222 will end up being:
   *     outputfolder/1234564/11222/2222/222222/
   * 
   * This will reduce the number of folders in the main directory.
   * We may need to change it a bit and do 2 numbers at a time, 
   * e.g. outputfolder/12/1234/12345 to keep the depth managable
   * 
   * For the UUID, we can probably get away with 
   * outputfolder/1/2/3/4/5/6/4/11222-2222-222222
   * 
   * @param {*} contentId 
   */
  _createContentFolder(contentId) {

    let uniqueid = uuidV4();

    //Lets do the /ab/ab123455-1234-.../ version (i.e. 2 levels deep)

    //let dirparts = uniqueid.split('-');
    let dirs = [
      uniqueid.substring(0,2),
      uniqueid
    ];

    //Return the promise to create the full dir tree.
    return new Promise((resolve, reject) => {

      // Setup the current folder be the main output
      let currDirFull = this.outputFolder;

      // Loop over every "dir" to create the structure
      // We will do this synchronously to handle existing
      // folders, while maintaining sanity.
      dirs.forEach((dirFrag) => {
          currDirFull = path.join(currDirFull, dirFrag);
          try {
            fs.mkdirSync(currDirFull);
          } catch(e) {
            if (e.code != 'EEXIST' ) return reject(e);
          }
      });

      resolve(currDirFull);
    });
  }

  /**
   * Gets promise for fetching a PSI for a strategy.  This is the actual function
   * that does the work.
   * @param {*} url The URL
   * @param {*} strategy The stategy (mesktop or mobile)
   */
  _getInsights(url, strategy) {
    //Since the simple-rate-limiter library is callback based, we need to
    //re-wrap that call as a promise.
    return new Promise((resolve, reject) => {
      this.logger.debug(`Insights for ${url} strategy ${strategy}`);
      getPSI(
        url, 
        {
          key: this.apiKey,
          strategy: strategy
        }, 
        this.logger,
        (err, res) => {
          if (err) {            
            reject(err);
          } else {
            resolve(res);
          }
        });
    });
  }

  /**
   * Gets the insights for desktop and mobile for a content item.
   * 
   * @param {*} fetchItem 
   */
  _getInsightsAndSave(url) {

    let reportFolder = null;

    this.logger.debug(`Insights for ${url}`)

    return this._createContentFolder()
      .then((folder) => {
        reportFolder = folder;
      })
      // Get Desktop version
      .then(() => {
        return retry(this._getInsights.bind(this, url, 'desktop'), { interval: 60000, max_tries: 15 });
      })
      // Save Desktop
      .then((results) => {
        this.logger.debug(`Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        return this._saveFile(reportFolder, 'desktop.json', results);
      })
      // Get Mobile versions
      .then(() => {
        return retry(this._getInsights.bind(this, url, 'mobile'), { interval: 60000, max_tries: 15 });
      })
      // Save Mobile
      .then((results) => {
        this.logger.debug(`Mobile: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        return this._saveFile(reportFolder, 'mobile.json', results);        
      });
  }

  /**
   * Process insights for a single URL within a batch
   * @param {*} url The URL to process
   * @returns {Promise}  
   */
  _processUrlFromBatch(url) {
    this.logger.debug(`_processUrls: Processing ${url}`);

    return this._getInsightsAndSave(url)
      //This will be called only if it succeeds
      .then(() => {
        this.fetchedItems++;
      })
      //This will be called only if error
      .catch((err) => {            
        this.logger.error(`Error getting URL: ${url}.`);
        this.logger.error(err);
        this.errorCount++;
      })
      //This will always be called as the last in the chain.
      .then(() => {
        this.processedItems++;

        //Every 100 items output progress.
        if (this.processedItems % 25 == 0) {
          this.logger.info(`Items Processed: ${this.processedItems}. Fetched: ${this.fetchedItems}  Errors: ${this.errorCount}`);
        }
      });
  }

  /**
   * Returns a promise that processes a list of URLs fetching the PSIs in batches.
   * 
   * @param {*} urls 
   * @param {*} done 
   */
  _processUrls(urls) {

    //Uncomment for sane testing of small batches.
    //urls = _.take(urls, 25);

    this.logger.info(`Items Queued: ${urls.length}`);
    
    
    let promiseChain = this.storageProvider
      //Start our promise chain with the storageProvider's onBegin method
      .onBegin(urls)
      //Then run through our main parsing logic
      .then(() => {
        //This is a special Bluebird promise extension.
        return Promise.map(
          urls,
          this._processUrlFromBatch.bind(this),
          { concurrency: 20 }
        ).then(() => {
          //This should output one final time at the end.
          this.logger.info(`Items Queued: ${urls.length} Items Processed: ${this.processedItems}. Fetched: ${this.fetchedItems}  Errors: ${this.errorCount}`);
        })
      })
      //Then call the provider's on completion
      .then(() => {
        //would be nice to pass in items processes/errors
        return this.storageProvider.onEnd(urls.length, this.processedItems, this.fetchedItems, this.errorCount);
      })
      //If an error occurred, call the provider's onFatal error
      .catch((err) => {
        logger.error("Fatal error occurred while processing URLs");
        logger.error(err);
        return this.storageProvider.onFatalError(err)
          //If onFatalError is successful then rethrow the original error for the caller to catch
          .then(() => {
            throw err; 
          })
          //If we get an error from 
          .catch((fatalErrorErr) => {

          })
      })

  }

  /**
   * Promised folder creation
   * 
   * @param {*} outputFolder 
   */
  //_mkdirOutputFolder(outputFolder) {
  //  return new Promise((resolve, reject) => {
  //    fs.mkdir(outputFolder, (err) => {
  //      if (err) { reject(err); }
  //      else { resolve(); }
  //    })
  //  });
  //}

  /**
   * Returns a promise that will process a list of sitemap URLs and determine which urls are HTML pages, 
   * resolving the promise with only the HTML pages.
   * @param {*} sites 
   */
  _extractHtmlPages(sites) {
    return new Promise((resolve, reject) => {
      let errCount = 0;
      async.filterLimit(
        sites,
        10,
        (site, cb) => {
          rp.head(site)
            .then((head) => {
              if (head['content-type'] == 'text/html; charset=utf-8') {
                cb(null,true);
              } else {
                this.logger.info(`Skipping non-Html file ${site}`);
                cb(null, false);
              }
            })
            .catch((err) => {
              //Treat it as a move along.
              this.logger.info(`Error on ${site}`);
              errCount++;
              cb(null, false);
            })
        },
        (err, sites) => {
          this.logger.info(`Sitemap Filter Error Count ${errCount}`);
          if (err) {
            reject(err);
          } else {
            resolve(sites);
          }
        }
      )
    });
  }

  /**
   * Process insights
   */
  process() {
    
 
    //Setup the sitemap
    var sitemap = new Sitemapper({
      url: `${this.server}/sitemap.xml`,
      timeout: 120000
    });
    
    let rtnPromise =
      //Call promisified mkdir
      // fsp.mkdirAsync(this.outputFolder) <-- move to onBegin of fileSystemProcessor
      //this._mkdirOutputFolder(this.outputFolder)
      //Then move to fetching the sitemap
//      .then(() => {
//        this.logger.debug("Fetching Sitemap");
//        return sitemap.fetch();
//      })
      //The chain starts with the fetch of the site map.
      sitemap.fetch() 
      //Check everypage in the sitemap to ensure HTML
      .then((res) => {
        return this._extractHtmlPages(res.sites);
      })
      //Process all the HTML pages.
      .then((sites) => {
        return this._processUrls(sites);
      })

    return rtnPromise;
  }
}

module.exports = InsightsProcessor;