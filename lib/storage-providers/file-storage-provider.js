'use strict';

const Promise                       = require('bluebird');
const fs                            = require('fs');
const moment                        = require('moment');
const path                          = require('path');
const uuidV4                        = require('uuid/v4');
const util                          = require('util');

const AbstractStorageProvider       = require('./abstract-storage-provider');

/**
 * Represent a PSI reporter storage provider that stores information in the filesystem
 */
class FileStorageProvider extends AbstractStorageProvider {

    /**
     * Creates a new instance of a FileStorageProvider
     * @param {*} logger A logger for logging messages
     * @param {*} config A config object that contains the folder path to output files to
     */
    constructor(logger, config) {
        super(logger);
        this.config = config;
        let timestamp = moment().format('YYYYMMDD_hhmmss');
        this.outputFolder = path.join(process.cwd(), config.output_dir, timestamp);
        this.logger.info(`FileStorageProvider: Using ${this.outputFolder} for output`);
        this.urlIDLookup = {}; //This is for generating a uniqueid for a given URL
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    onBegin(urlList) {
        this.logger.debug("FileStorageProvider: Initializing Run");
        //Create output folder

        return new Promise((resolve, reject) => {
            fs.mkdir(this.outputFolder, (err) => {              
              if (err) { reject(err); }
              else { 
                this.logger.debug(`FileStorageProvider: Created output folder ${this.outputFolder}`);
                resolve(); 
              }
            })
        });
    }

    /**
     * Gets the unique ID for a given URL
     * @param {*} url 
     */
    _getIDForURL(url) {
        if (!this.urlIDLookup[url]) {
            this.urlIDLookup[url] = uuidV4(); 
        }

        return this.urlIDLookup[url]
    }

    /**
     * Stores an individual PSI record to the back-end storage
     * @param {*} url The URL being fetched.
     * @param {*} strategy The PSI strategy being used (desktop vs mobile)
     * @param {*} psiRecord The object representing the PSI response
     * @returns {Promise}
     */
    storePSIRecord(url, strategy, psiRecord) {
        this.logger.debug(`FileStorageProvider: Saving ${url} for ${strategy}`);

        let filename = `${strategy}.json`;

        let promiseChain = 
            this._createContentFolder(this._getIDForURL(url))
            .then((reportFolder) => {
                this.logger.debug(`FileStorageProvider: Saving ${filename} for ${url}`);
                //Should make filename unique for bad cleanups.
                
                return this._saveFile(reportFolder, filename, psiRecord);
            })        
        return promiseChain;
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
                this.logger.debug(err);
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
        this.logger.debug(`FileStorageProvider: Ending Run`);
        //Update DB record for successful run ending.

        return Promise.resolve();
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    onEndFatal(message) {
        this.logger.error("Fatal Error occured in process(). Ending Fatally with error: ")
        this.logger.error(message);
        this.logger.debug(`FileStorageProvider: Handling Fatal Errors`);
        //Update DB record for ending run with error.

        return Promise.resolve();
    }

    /**
     * Gets an instance of a FileStorageProvider given a config with the folder path.
     * @param {*} logger A logger for logging messages
     * @param {*} config A config object that contains the folder path to output files to
     * @returns {Promise}
     */
    static GetProviderInstance(logger, config) {
        return new Promise((resolve, reject) => {
            resolve(new FileStorageProvider(logger, config));
        })
    }

    /**
     * Method for validating the configuration of a Storage Provider.
     * This allows for a calling class to not have to care what type of storage provider
     * but still be able to validate a config object.
     * @param {*} config 
     */
    static ValidateConfig(config) {
        return config["output_dir"] && config.output_dir != "";
    }

  /**
   * Saves a json file asynchronously.  Returns a promise
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
   * @param {*} psiid 
   */
  _createContentFolder(psiid) {
    
    let uniqueid = psiid;

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
                if (e.code != 'EEXIST' ) {
                    return reject(e);
                }
            }
        });
        
        resolve(currDirFull);
    });
    }
  }

module.exports = FileStorageProvider;