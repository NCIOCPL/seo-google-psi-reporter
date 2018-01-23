'use strict';

const Promise         = require('bluebird');
const _               = require('lodash');
const async           = require('async');
const Logger          = require('./logger');
const limit           = require('simple-rate-limiter');
const retry           = require('bluebird-retry');
const psi             = require('psi');



/**
 * Defines throttled function to fetch results.
 */
var getPSI = limit(function(url, psiOpt, logger, callback) {
  logger.info(`LIMIT: Fetching ${url} for ${psiOpt.strategy}`);

  psi(url, psiOpt)
  .then((res) => { //If succeeded, then call our callback
    logger.debug(`LIMIT: Finished Fetching ${url} for ${psiOpt.strategy}.`);  
    callback(null,res);
  }).catch((err) => { //If failed, then call the callback with an error.
    logger.error(`LIMIT: Err Fetching ${url} for ${psiOpt.strategy}. ${err}`);
    callback(err, null);
  });
}).to(1).per(2000);


/**
 * Class that is used to extract a sitemap.xml and get page speed insights for those URLs
 */
class InsightsProcessor {

  /**
   * Creates a new instance of the InsightsProcessor
   * @param {*} logger
   * @param {*} storageProvider An instance of a Storage Provider class for storing the PSI information.
   * @param {*} options 
   */
  constructor(logger, storageProvider, options) {
    this.logger = logger;
    this.storageProvider = storageProvider;
    this.apiKey = options.insightsApiKey;
    // This is how many URLs to query google at once.  Note: 2 strategies means batch_size * 2 req/batch
    this.psi_batch_size = options.psi_batch_size;
    this.psi_batch_sleep = options.psi_batch_sleep;
    // This is how many urls to take at a time
    this.psi_max_async = options.psi_max_async;
    this.psi_max_retries = options.psi_max_retries;
    this.psi_waittime_between_errors = options.psi_waittime_between_errors;
    this.logger.info(`Using Key: ${this.apiKey}`);

    //Counter for status
    this.processedItems = 0;

    //Counter for fetchedItems.
    this.fetchedItems = 0;

    //Count errors
    this.errorCount = 0;
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
      getPSI(
        url, 
        { 
          key: this.apiKey,
          strategy: strategy
        }, 
        this.logger,
        (err, res) => {
          if (err) {
            this.logger.debug("_getInsights: Rejecting promise");
            return reject(err);
          } else {
            return resolve(res);
          }
        });
    });
  }

  /**
   * This method is for getting and saving the results of a URL for a single strategy 
   * @param {*} url 
   * @param {*} strategy 
   */
  _getStrategyAndSave(url, strategy) {

    this.logger.debug(`_getStrategyAndSave: Fetching ${strategy}: ${url}`);

    let fetchError = null;

    let promiseChain = 
      retry(
        //Retry this function
        this._getInsights.bind(this, url, strategy), 
        //Settings for retry
        { interval: this.psi_waittime_between_errors, max_tries: this.psi_max_retries })
      .catch( err => { 
        this.logger.debug(`_getStrategyAndSave: Error occurred for ${strategy} for ${url}`)
        //Store the error so we can log it in the next step of the chain
        fetchError = err;
      })
      .then((results) => {
        if (fetchError != null) {
          this.logger.debug(`_getStrategyAndSave: ${strategy}: failed to fetch ${url} `)
          return this.storageProvider.storePSIError(url, strategy, fetchError)
            .then(() => {return true;}); //Had error
        } else {
          this.logger.debug(`_getStrategyAndSave: ${strategy}: ${results.id} : ${results.ruleGroups.SPEED.score}`);
          //Should make filename unique for bad cleanups.
          return this.storageProvider.storePSIRecord(url, strategy, results)
            .then(() => {return false;}); //Had no error
        }
      })

    return promiseChain;
  }

  /**
   * Gets the insights for desktop and mobile for a content item.
   * 
   * @param {*} fetchItem 
   */
  _getInsightsAndSave(url) {

    //let reportFolder = null;

    this.logger.debug(`_getInsightsAndSave: Insights for ${url}`)

    //Stragegies to pull.  TODO: make configurable?
    let strategies = ['desktop', 'mobile'];

    let hasError = false;

    //Basically call _getStrategyAndSave for each of the strategies for this URL.
    let rtnPromise = Promise.all(strategies.map(strategy => {
      return this._getStrategyAndSave(url, strategy)
        .then((hadStrategyError) => {
          //This code would run multiple times for a URL, we should indicate an error if 
          //any strategy failed.
          if (!hasError && hadStrategyError) {
            hasError = true;
          }
        })
      })
    ).then(() => {
      return hasError;
    });

    return rtnPromise;

    /*
    this.storageProvider.storePSIRecord(url, 'desktop', results);
    let promiseChain = new Promise((resolve, reject) => {
        this.logger.debug(`_getInsightsAndSave: Fetching Desktop: ${url}`);
        // Get Desktop version
        return retry(this._getInsights.bind(this, url, 'desktop'), { interval: this.psi_waittime_between_errors, max_tries: this.psi_max_retries })
          .caught(err => { //This is needed to "rethrow the error"
            reject(err); //Store error?
          })
      })
      // Save Desktop
      .then(
        (results) => {
        this.logger.debug(`_getInsightsAndSave: Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        return 
      })
      // Get Mobile versions
      .then(() => {
        return retry(this._getInsights.bind(this, url, 'mobile'), { interval: this.psi_waittime_between_errors, max_tries: this.psi_max_retries })
          .caught(err => {
            
          })
      })
      // Save Mobile
      .then((results) => {
        this.logger.debug(`Mobile: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        this.storageProvider.storePSIRecord(url, 'mobile', results);
      });

    return promiseChain;
    */
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
      .then((hasError) => {
        if (hasError) {
          this.logger.error(`Error getting URL: ${url}.`);
          this.errorCount++;
        } else {
          this.fetchedItems++;
        }
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
  process(urls) {

    //Uncomment for sane testing of small batches.
    urls = _.take(urls, 1);

    this.logger.info(`process: Items Queued: ${urls.length}`);
    
    
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
          this.logger.info(`process: Items Queued: ${urls.length} Items Processed: ${this.processedItems}. Fetched: ${this.fetchedItems}  Errors: ${this.errorCount}`);
        })
      })
      //Then call the provider's on completion
      .then(() => {
        //would be nice to pass in items processes/errors
        return this.storageProvider.onEnd(urls.length, this.processedItems, this.fetchedItems, this.errorCount);
      })
      //If an error occurred, call the provider's onFatal error
      .catch((err) => {
        //Log this here - if onEndFatal ends fatally, then we would lose the original fatal error.
        this.logger.error("Fatal Error occured in process(). Ending Fatally with error: ")
        this.logger.error(err);

        //Now handle the fatal error
        return this.storageProvider.onEndFatal(err)
          //If onFatalError is successful then rethrow the original error for the caller to catch
          .then(() => {
            throw err;
          })
          //Any errors from onFatalError will be handled by the main process.
      })

      return promiseChain;
  }





  /**
   * Process insights
   */
//  process(urls) {
//    let rtnPromise =
      //Call promisified mkdir
      // fsp.mkdirAsync(this.outputFolder) <-- move to onBegin of fileSystemProcessor
      //this._mkdirOutputFolder(this.outputFolder)
      //Then move to fetching the sitemap
//      .then(() => {
//        this.logger.debug("Fetching Sitemap");
//        return sitemap.fetch();
//      })
      //The chain starts with the fetch of the site map.
      //Process all the HTML pages.
//      this.logger.debug("Beginning ProcessUrls")
//      return this._processUrls(urls);
//  }
}

module.exports = InsightsProcessor;