'use strict';

const AbstractStorageProvider       = require('./abstract-storage-provider');
const fs                            = require('fs');


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
    }

    /**
     * Method called before scraping has begun
     * @param {*} urlList A list of URLs to be scraped.
     * @returns {Promise}
     */
    onBegin(urlList) {
        this.logger.debug("FileStorageProvider: Initializing Run");
        //Create folder


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
        this.logger.debug(`FileStorageProvider: Saving ${url} for ${strategy}`);
        this._createContentFolder()
            .then((folder) => {
                reportFolder = folder;
            })
            .then((results) => {
                this.logger.debug(`Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
                //Should make filename unique for bad cleanups.
                
                return this._saveFile(reportFolder, 'desktop.json', results);
              })
        
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
        this.logger.debug(`FileStorageProvider: Ending Run`);
        //Update DB record for successful run ending.

        return Promise.resolve();
    }

    /**
     * Method called when a fatal error is encountered ending the scraping
     * @param {string} message The error message
     * @returns {Promise}
     */
    onFatalError(message) {
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
        return true;
    }

  /**
   * Promised folder creation
   * 
   * @param {*} outputFolder 
   */
  _mkdirOutputFolder(outputFolder) {
    return new Promise((resolve, reject) => {
      fs.mkdir(outputFolder, (err) => {
        if (err) { reject(err); }
        else { resolve(); }
      })
    });
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

}

module.exports = FileStorageProvider;