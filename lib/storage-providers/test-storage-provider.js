'use strict';

const AbstractStorageProvider       = require('./abstract-storage-provider');

/**
 * Represent a PSI reporter storage provider that stores information in the filesystem
 */
class TestStorageProvider extends AbstractStorageProvider {

    /**
     * Creates a new instance of a FileStorageProvider
     * @param {*} logger A logger for logging messages
     * @param {*} config A config object that contains the folder path to output files to
     */
    constructor(logger, config) {
        super(logger);
        this.config = config;
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    onBegin(urlList) {
        return new Promise((resolve, reject) => {
            this.logger.debug("TestStorageProvider: Initializing Run");            
            let thelogger = this.logger;
            setTimeout(() => {
                thelogger.debug(`TestStorageProvider: Beginning with ${urlList.length} URLs`);            
                resolve();
            }, 250);
        });
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    storePSIRecord(url, strategy, psiRecord) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.debug(`TestStorageProvider: Saving ${url} for ${strategy}`);
                console.log(psiRecord);
                //reject(new Error("Error while storingPSIRecord"));
                resolve();
            }, 100);
        });
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} err The object representing the PSI response
     * @returns {Promise}
     */
    storePSIError(url, strategy, err) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.debug(`TestStorageProvider: ERROR ${url} for ${strategy}`);                
                //this.logger.debug(err);
                return reject(new Error("Testing storePSIError"));
                resolve();
            }, 100);
        });
    }

    /**
     * Method called after all items are scraped
     * @param {number} totalUrls The total number of URLs to process
     * @param {number} itemsProcessed The number of items process
     * @param {number} itemsFetched The number of items successfully fetched
     * @param {number} errorCount The number of items with errors
     * @returns {Promise}
     */
    onEnd(totalUrls, itemsProcessed, itemsFetched, errorCount) {        
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.debug(`TestStorageProvider: Ending Run`);                
                resolve();
            }, 100);
        })
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    onEndFatal(message) {        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.logger.debug(`TestStorageProvider: Handling Fatal Errors`);
                //this.logger.debug(message)
                resolve();
            }, 100);
        })        
    }

    /**
     * Gets an instance of a FileStorageProvider given a config with the folder path.
     * @param {*} logger A logger for logging messages
     * @param {*} config A config object that contains the folder path to output files to
     * @returns {Promise}
     */
    static GetProviderInstance(logger, config) {        
        return new Promise((resolve, reject) => {
            resolve(new TestStorageProvider(logger, config));
        })
    }

    /**
     * Method for validating the configuration of a Storage Provider.
     * This allows for a calling class to not have to care what type of storage provider
     * but still be able to validate a config object.
     * @param {*} config 
     */
    static ValidateConfig(config) {
        return true;
    }


}

module.exports = TestStorageProvider;