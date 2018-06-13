'use strict';

const Promise         = require('bluebird');
const _               = require('lodash');
const async           = require('async');
const limit           = require('simple-rate-limiter');
const retry           = require('bluebird-retry');
const psi             = require('psi');



/**
 * Defines throttled function to fetch results.
 * @param {*} url The URL to fetch
 * @param {*} psiOpt The options passed to PSI
 * @param {*} logger A logger to use for logging
 * @param {*} callback A callback called upon completion/error
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
   * Gets promise for fetching a PSI for a strategy.  This is the actual function
   * that does the work.
   * @param {*} url The URL
   * @param {*} strategy The stategy (mesktop or mobile)
   * @param {*} apiKey The API key to use for the request
   * @param {*} logger A logger to use for logging
 */
function getPSIAsync(url, strategy, apiKey, logger) {
  //Since the simple-rate-limiter library is callback based, we need to
  //re-wrap that call as a promise.
  return new Promise((resolve, reject) => {
    getPSI(
      url, 
      { 
        key: apiKey,
        strategy: strategy
      }, 
      logger,
      (err, res) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(res);
        }
      });
  });
}

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
   * This method is for getting and saving the results of a URL for a single strategy 
   * @param {*} url 
   * @param {*} strategy
   */
  async _getStrategyAndSave(url, strategy) {

    this.logger.debug(`_getStrategyAndSave: Fetching ${strategy}: ${url}`);

    let results = null;
    let fetchError = null;

    try {
      results = await retry(
        //Retry this function
        getPSIAsync.bind(null, url, strategy, this.apiKey, this.logger), 
        //Settings for retry
        { interval: this.psi_waittime_between_errors, max_tries: this.psi_max_retries }
      );      
    } catch (err) {      
      fetchError = err;
    }

    if (results != null) {
      //SUCCEEDED
      this.logger.debug(`_getStrategyAndSave: ${strategy}: ${results.id} : ${results.ruleGroups.SPEED.score}`);
      await this.storageProvider.storePSIRecord(url, strategy, results);
      return false;
    } else {
      // FAILED
      this.logger.debug(`_getStrategyAndSave: ${strategy}: failed to fetch ${url} `)
      await this.storageProvider.storePSIError(url, strategy, fetchError);
      return true;
    }
  }

  /**
   * Gets the insights for desktop and mobile for a content item.
   * 
   * @param {*} fetchItem 
   */
  async _getInsightsAndSave(url) {

    //let reportFolder = null;

    this.logger.debug(`_getInsightsAndSave: Insights for ${url}`)

    //Stragegies to pull.  TODO: make configurable?
    let strategies = ['desktop', 'mobile'];

    //Did any of our strategies have an error?
    let hasError = false;

    //Run through each strategy
    await Promise.all(
      strategies.map( async (strategy) => {
        let hadStrategyError = await this._getStrategyAndSave(url, strategy);        
        if (!hasError && hadStrategyError) {
          hasError = true;
        }
      })
    );

    return hasError;
  }

  /**
   * Process insights for a single URL within a batch
   * @param {*} url The URL to process
   * @returns {Promise}  
   */
  async _processUrlFromBatch(url) {

    this.logger.debug(`_processUrls: Processing ${url}`);

    let hasError = await this._getInsightsAndSave(url);

    if (hasError) {
      this.logger.error(`Error getting URL: ${url}.`);
      this.errorCount++;  
    } else {
      this.fetchedItems++;
    }

    this.processedItems++;

    //Every 100 items output progress.
    if (this.processedItems % 25 == 0) {
      this.logger.info(`Items Processed: ${this.processedItems}. Fetched: ${this.fetchedItems}  Errors: ${this.errorCount}`);
    }
  }

  /**
   * Returns a promise that processes a list of URLs fetching the PSIs in batches.
   * 
   * @param {*} urls 
   * @param {*} done 
   */
  async process(urls) {

    //Uncomment for sane testing of small batches.
    //Unit tests would be better than comments.
    //urls = _.take(urls, 1);

    this.logger.info(`process: Items Queued: ${urls.length}`);
    
    //Setup anything that is needed before we start
    await this.storageProvider.onBegin(urls);
    
    try {
      //Now process the URLs
      await Promise.map(
        urls,
        this._processUrlFromBatch.bind(this),
        { concurrency: 20 }
      );

      //Log the final counts
      this.logger.info(`process: Items Queued: ${urls.length} Items Processed: ${this.processedItems}. Fetched: ${this.fetchedItems}  Errors: ${this.errorCount}`);

    } catch (err) {
      //A Fatal error occurred while processing URLs
      
      // Log the fatal error to the storage provider
      try {
        await this.storageProvider.onEndFatal(err);
      } catch (fatalErr) {
        //We had an error storing the fatal error. Rethrow.   
        throw fatalErr;
      }
      
      throw new Error("Processing finished with fatal error. Please check the logs.");
    }

    //End if things went well.
    await this.storageProvider.onEnd(urls.length, this.processedItems, this.fetchedItems, this.errorCount);
  }

}

module.exports = InsightsProcessor;