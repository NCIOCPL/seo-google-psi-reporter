'use strict';

class AbstractStorageProvider {

    /**
     * Creates a new instance of the derived AbstractStorageProvider
     * @param {*} logger The logger for outputting messages
     */
    constructor(logger) {
        if (this.constructor === AbstractStorageProvider) {
            throw new TypeError("Cannot construct AbstractStorageProvider");
        }

        if (this.onBegin === AbstractStorageProvider.prototype.onBegin) {
            throw new TypeError("Must implement abstract method onBegin");
        }

        if (this.onEnd === AbstractStorageProvider.prototype.onEnd) {
            throw new TypeError("Must implement abstract method onEnd");
        }

        if (this.onEndFatal === AbstractStorageProvider.prototype.onEndFatal) {
            throw new TypeError("Must implement abstract method onEndFatal");
        }

        if (this.storePSIRecord === AbstractStorageProvider.prototype.storePSIRecord) {
            throw new TypeError("Must implement abstract method storePSIRecord");
        }

        if (this.storePSIError === AbstractStorageProvider.prototype.storePSIError) {
            throw new TypeError("Must implement abstract method storePSIError");
        }

        this.logger = logger;        
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    async onBegin(urlList) {
        throw new TypeError("Cannot call abstract method onBegin from derrived class");
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    async storePSIRecord(url, strategy, psiRecord) {
        throw new TypeError("Cannot call abstract method storePSIRecord from derrived class");
    }

    /**
     * Stores an individual PSI Error record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} err The object representing the PSI error
     * @returns {Promise}
     */
    async storePSIError(url, strategy, err) {
        throw new TypeError("Cannot call abstract method storePSIError from derrived class");
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
        throw new TypeError("Cannot call abstract method onEnd from derrived class");
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    async onEndFatal(message) {
        throw new TypeError("Cannot call abstract method onFatalError from derrived class");
    }

    /**
     * Method for validating the configuration of a Storage Provider.
     * This allows for a calling class to not have to care what type of storage provider
     * but still be able to validate a config object.
     * @param {*} config 
     */
    static ValidateConfig(config) {
        throw new TypeError("Cannot call abstract static method ValidateConfig from derrived class");
    }

    /**
     * Gets an instance of a Storage Provider given a config object.
     * @param {*} logger A logger for logging messages
     * @param {*} config The storage Providers config object
     * @returns {Promise}
     */
    static async GetProviderInstance(logger, config) {
        throw new TypeError("Cannot call abstract static method GetProviderInstance from derrived class");
    }

}

module.exports = AbstractStorageProvider;