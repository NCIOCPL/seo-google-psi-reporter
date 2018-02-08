'use strict';

const util          = require('util');

const AbstractStorageProvider       = require('./abstract-storage-provider');

const setTimeoutPromise = util.promisify(setTimeout);

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
    async onBegin(urlList) {
        this.logger.debug("TestStorageProvider: Initializing Run");
        await setTimeoutPromise(250);
        this.logger.debug(`TestStorageProvider: Beginning with ${urlList.length} URLs`);
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    async storePSIRecord(url, strategy, psiRecord) {
        this.logger.debug(`TestStorageProvider: Saving ${url} for ${strategy}`);
        await setTimeoutPromise(250);
        console.log(psiRecord);
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} err The object representing the PSI response
     * @returns {Promise}
     */
    async storePSIError(url, strategy, err) {
        this.logger.debug(`TestStorageProvider: ERROR ${url} for ${strategy}`);
        await setTimeoutPromise(250);
    }

    /**
     * Method called after all items are scraped
     * @param {number} totalUrls The total number of URLs to process
     * @param {number} itemsProcessed The number of items process
     * @param {number} itemsFetched The number of items successfully fetched
     * @param {number} errorCount The number of items with errors
     * @returns {Promise}
     */
    async onEnd(totalUrls, itemsProcessed, itemsFetched, errorCount) {        
        await setTimeoutPromise(250);
        this.logger.debug(`TestStorageProvider: Ending Run`);
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    async onEndFatal(message) {
        this.logger.error("Fatal Error occured in process(). Ending Fatally with error: ")
        this.logger.error(message);
        await setTimeoutPromise(250);
        this.logger.debug(`TestStorageProvider: Handling Fatal Errors`);
    }

    /**
     * Gets an instance of a FileStorageProvider given a config with the folder path.
     * @param {*} logger A logger for logging messages
     * @param {*} config A config object that contains the folder path to output files to
     * @returns {Promise}
     */
    static async GetProviderInstance(logger, config) {
        await setTimeoutPromise(250);
        return new TestStorageProvider(logger, config);
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