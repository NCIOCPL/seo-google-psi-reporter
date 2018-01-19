'use strict';

const AbstractStorageProvider       = require('./abstract-storage-provider');
const sql                           = require('mssql');


/**
 * Represent a PSI reporter storage provider that stores information in the database
 */
class DBStorageProvider extends AbstractStorageProvider {

    /**
     * Creates a new instance of a DBStorageProvider
     * @param {*} logger A logger for logging messages
     * @param {*} connectionPool A TDS connection pool to use
     */
    constructor(logger, connectionPool) {
        super(logger);
        this.pool = connectionPool;
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    onBegin(urlList) {
        logger.debug("DBStorageProvider: Initializing Run");
        //Add record to DB for run.  Get back run ID (guid)
        return Promise.resolve();
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    storePSIRecord(url, strategy, psiRecord) {
        logger.debug(`DBStorageProvider: Saving ${url} for ${strategy}`);
        return Promise.resolve();
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
        logger.debug(`DBStorageProvider: Ending Run`);
        //Update DB record for successful run ending.

        return Promise.resolve();
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    onFatalError(message) {
        logger.debug(`DBStorageProvider: Handling Fatal Errors`);
        //Update DB record for ending run with error.

        return Promise.resolve();
    }


    /**
     * Gets an instance of a DBStorageProvider given DB connection info.
     * @param {*} logger A logger for logging messages
     * @param {*} config Database connection configuration
     * @returns {Promise}
     */
    static GetProviderInstance(logger, config) {

        // This method allows for us to get a configured instance, while allowing
        // us to have a mockable connectionPool so that we may test this class.
        return sql.connect(config)
            .then(pool => {
                return new DBStorageProvider(logger, pool);
            })

        //Catch should be handled by the caller.  It does not make sense to wrap the 
        //error message for now
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

module.exports = DBStorageProvider;