'use strict';

const sql                           = require('mssql');
const uuidV4                        = require('uuid/v4');

const AbstractStorageProvider       = require('./abstract-storage-provider');

const RUN_STATUS = {
    Running: "RUNNING",
    Succeeded: "SUCCEEDED",
    Failed: "FAILED"
}

const PSI_STATUS = {    
    Succeeded: "SUCCEEDED",
    Failed: "FAILED"
}

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
        this.runID = uuidV4();
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    async onBegin(urlList) {
        this.logger.debug("DBStorageProvider: Initializing Run");
        
        //Add record to DB for run.
        try {
            await new sql.Request(this.pool)
                .input('runid', sql.UniqueIdentifier, this.runID)
                .input('begintime', sql.DateTimeOffset, new Date())
                .input('totalUrls', sql.Int, urlList.length)
                .input('status', sql.VarChar, RUN_STATUS.Running)
                .query(`insert into PSI_runs 
                        (runid, begintime, totalUrls, status) 
                        VALUES 
                        (@runid, @begintime, @totalUrls, @status)`);
        } catch(err) {
            this.logger.error("DBStorageProvider: onBegin encountered error. Closing the pool")
            this.pool.close(); //Close if it was open.
            throw err;
        }

        return;
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    async storePSIRecord(url, strategy, psiRecord) {
        this.logger.debug(`DBStorageProvider: Saving ${url} for ${strategy}`);

        //Add record to DB for run.
        try {
            await new sql.Request(this.pool)
                .input('runid', sql.UniqueIdentifier, this.runID)
                .input('url', sql.VarChar, url)
                .input('strategy', sql.VarChar, strategy)
                .input('result', sql.VarChar, JSON.stringify(psiRecord))
                .input('status', sql.VarChar, PSI_STATUS.Succeeded)
                .query(`insert into PSI 
                        (runid, url, strategy, result, status) 
                        VALUES 
                        (@runid, @url, @strategy, @result, @status)`);
        } catch(err) {
            this.logger.error("DBStorageProvider: storePSIRecord encountered error.")
            throw err;
        }

        return;
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} err The object representing the PSI response
     * @returns {Promise}
     */
    async storePSIError(url, strategy, err) {
        this.logger.debug(`TestStorageProvider: Storing ERROR for ${url} for ${strategy}`);

        //Add record to DB for run.
        try {
            await new sql.Request(this.pool)
                .input('runid', sql.UniqueIdentifier, this.runID)
                .input('url', sql.VarChar, url)
                .input('strategy', sql.VarChar, strategy)
                .input('result', sql.VarChar, JSON.stringify(err))
                .input('status', sql.VarChar, PSI_STATUS.Failed)
                .query(`insert into PSI 
                        (runid, url, strategy, result, status) 
                        VALUES 
                        (@runid, @url, @strategy, @result, @status)`);
        } catch(err) {
            this.logger.error("DBStorageProvider: storePSIError encountered error.")
            throw err;
        }

        return;
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
        this.logger.debug(`DBStorageProvider: Ending Run`);

        //Update DB record for successful run ending.
        try {
            await new sql.Request(this.pool)
                .input('runid', sql.UniqueIdentifier, this.runID)
                .input('endtime', sql.DateTimeOffset, new Date())
                .input('itemsProcessed', sql.Int, itemsProcessed)
                .input('itemsFetched', sql.Int, itemsFetched)
                .input('errorCount', sql.Int, errorCount)
                .input('status', sql.VarChar, RUN_STATUS.Succeeded)
                .query(`update PSI_runs SET
                            endtime = @endtime,
                            itemsProcesses = @itemsProcessed,
                            itemsFetched = @itemsFetched,
                            errorCount = @errorCount,
                            status = @status
                        WHERE runid = @runid`);
        } catch(err) {
            this.logger.debug("DBStorageProvider: onEnd encountered error.");
            throw err;
        } finally {
            this.logger.debug("DBStorageProvider: Closing the pool")
            //Closeout the pool.
            this.pool.close();
        }

        return;
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    async onEndFatal(message) {
        this.logger.debug(`DBStorageProvider: Handling Fatal Errors`);

        //Update DB record for successful run ending.
        try {
            await new sql.Request(this.pool)
                .input('runid', sql.UniqueIdentifier, this.runID)
                .input('endtime', sql.DateTimeOffset, new Date())
                .input('errorMessage', sql.VarChar, this._errorToJSON(message))
                .input('status', sql.VarChar, RUN_STATUS.Failed)
                .query(`update PSI_runs SET
                            endtime = @endtime,
                            errorMessage = @errorMessage,
                            status = @status
                        WHERE runid = @runid`);
        } catch(err) {
            this.logger.debug("DBStorageProvider: onEndFatal encountered error.");
            throw err;
        } finally {
            this.logger.debug("DBStorageProvider: Closing the pool")
            //Closeout the pool.
            this.pool.close();
        }

        return;
    }

    /**
     * Helper method to actually get consistent and usable serialized errors.
     * @param {*} err 
     */
    _errorToJSON(err) {
        console.log(err)
        if (!err) {
            this.logger.debug("DBStorageProvider: errorToJSON: Error is empty");
            return null;
        } else if (err === Object(err) && 'toJSON' in Object(err)) {
            this.logger.debug("DBStorageProvider: errorToJSON: Error can be natively deserialized");
            return JSON.stringify(err);
        } else if (err instanceof Error ) {
            this.logger.debug("DBStorageProvider: errorToJSON: Error is an Error");
            return JSON.stringify({
                type: typeof err,
                message: err.message,
                name: err.name
            })
        } else {
            this.logger.debug("DBStorageProvider: errorToJSON: Error is something else.");
            return JSON.stringify({
                data: err
            });
        }
    }

    /**
     * Gets an instance of a DBStorageProvider given DB connection info.
     * @param {*} logger A logger for logging messages
     * @param {*} config Database connection configuration
     * @returns {Promise}
     */
    static async GetProviderInstance(logger, config) {
        // This method allows for us to get a configured instance, while allowing
        // us to have a mockable connectionPool so that we may test this class.

        let pool = null;

        try {
            pool = await sql.connect({
                server: config.server,
                port: config.port,
                database: config.db_name,
                user: config.login_name,
                password: config.password
            });
        } catch (err) {
            logger.error(`DBStorageProvider: GetInstance throw error ${err}`)
            throw err;
        }

        let storageProvider = new DBStorageProvider(logger, pool);

        return storageProvider;
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