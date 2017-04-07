'use strict';

const _               = require('lodash');
const async           = require('async');
const fs              = require('fs');
const Logger          = require('./logger');
const Promise         = require('bluebird');
const retry           = require('bluebird-retry');
const path            = require('path');
const psi             = require('psi');
const rp              = require('request-promise');
const Sitemapper      = require('sitemapper');
const uuidV4          = require('uuid/v4');

const BATCH_SIZE = 45; // This is how many URLs to query google at once.  Note: 2 strategies means batch_size * 2 req/batch
const MAX_ASYNC = 20; // This is how many urls to take at a time

class InsightsProcessor {

  constructor(server, options) {
    this.logger = new Logger({ name: 'insights-processor'});
    this.server = server;
    this.outputFolder = options.outputFolder;
    this.apiKey = options.insightsApiKey;
    this.logger.info(`Using Key: ${this.apiKey}`);
  }

  _saveFile(folderPath, filename, data) {
    let filePath = path.join(folderPath, filename);
    return new Promise((resolve, reject) => {      
      fs.writeFile(filePath, JSON.stringify(data), 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    });
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

    //Lets do the /1/2/3/4/5/6/4/2/12345/1234/123456 version
    let dirparts = uniqueid.split('-');
    let dirs = [];
    for(let i=0; i < dirparts[0].length; i++) {
      dirs.push(dirparts[0].substr(0, i + 1));      
    }
    for(let i=1; i < dirparts.length; i++) {
      dirs.push(dirparts[i]);
    }

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

  _getInsights(url, strategy) {
    return psi(url, {
          key: this.apiKey,
          strategy: strategy
      });
  }

  /**
   * Gets the insights for desktop and mobile for a content item.
   * 
   * @param {*} fetchItem 
   */
  _getInsightsAndSave(url) {

    let reportFolder = null;

    this.logger.info(`Insights for ${url}`)

    return this._createContentFolder()
      .then((folder) => {
        reportFolder = folder;
      })
      // Get Desktop version
      .then(() => {
        return retry(this._getInsights.bind(this, url, 'desktop'), { interval: 100000 });
      })
      // Save Desktop
      .then((results) => {
        this.logger.info(`Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        this._saveFile(reportFolder, 'desktop.json', results);
      })
      // Get Mobile versions
      .then(() => {
        return retry(this._getInsights.bind(this, url, 'mobile'), { interval: 100000 });
      })
      // Save Mobile
      .then((results) => {
        this.logger.info(`Mobile: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        this._saveFile(reportFolder, 'mobile.json', results);        
      });
  }

_processUrlBatch(batch) {
    return new Promise((resolve, reject) => {
      async.eachLimit(
        batch,
        MAX_ASYNC,
        (url, cb) => {
          this._getInsightsAndSave(url)
            .then(() => {              
              cb();
            })
            .catch((err) => {
              this.logger.error(`Error getting URL: ${url}`);
              this.logger.error(err); 
              cb(err);
            })
        },
        (err) => {
          if (err) { reject(err); }
          else { resolve(err); }
        }
      );
    });  
}


  /**
   * Handles the fetching of a single File entry in the PubContentListing results
   * 
   * @param {*} fileInfo 
   * @param {*} done 
   */
  _processUrls(urls) {

    let chunkedUrls = _.chunk(urls, BATCH_SIZE);

    return new Promise((resolve, reject) => {

      async.eachSeries(
        chunkedUrls,
        (batch, cb) => {
          this._processUrlBatch(batch)
            .then(() => {
              this.logger.info("sleeping");
            })
            .delay(100001) //Sleep 100 seconds, which is API req limit            
            .then(() => {
              this.logger.info("Finished Sleeping");
              //Move next
              cb();
            })
            .catch((err) => {
              this.logger.error(err); 
              cb(err);
            })
        },
        (err) => {
          if (err) { reject(err); }
          else { resolve(err); }
        }
      );
    });
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

    var sitemap = new Sitemapper({
      url: `${this.server}/sitemap.xml`,
      timeout: 120000
    });

    return this._mkdirOutputFolder(this.outputFolder)
      .then(() => {
        return sitemap.fetch();
      })
      .then((res) => {
        return this._extractHtmlPages(res.sites);
      })
      .then((sites) => {
        return this._processUrls(sites);
      })
  }
}

module.exports = InsightsProcessor;