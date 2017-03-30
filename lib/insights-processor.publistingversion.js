'use strict';

const async           = require('async');
const fs              = require('fs');
const Promise         = require('bluebird');
const path            = require('path');
const psi             = require('psi');

class InsightsProcessor {

  constructor(contentListingSvc, options) {
    this.contentListingSvc = contentListingSvc;
    this.outputFolder = options.outputFolder;
    this.apiKey = options.insightsApiKey;
    console.log(this.apiKey);
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
   * For example content id 12345 will end up being:
   *     outputfolder/1/12/123/1234/12345
   * 
   * This will reduce the number of folders in the main directory.
   * We may need to change it a bit and do 2 numbers at a time, 
   * e.g. outputfolder/12/1234/12345 to keep the depth managable
   * (or just make it outputfolder/1/2/3/4/5)
   * 
   * @param {*} contentId 
   */
  _createContentFolder(contentId) {

    let dirs = [];
    for(let i=0; i < contentId.length; i++) {
      dirs.push(contentId.substr(0, i + 1));      
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

  /**
   * Gets the insights for desktop and mobile for a content item.
   * 
   * @param {*} fetchItem 
   */
  _getInsightsAndSave(fetchItem) {

    let url = fetchItem.fetchURL;
    let contentId = fetchItem.contentId;
    let reportFolder = null;

    console.log(`Insights for ${url}`)
    return Promise.resolve()
      .then(() => {
        return this._createContentFolder(contentId);
      })
      .then((folder) => {
        reportFolder = folder;
      })
      // Get Desktop version
      .then(() => {
        return psi(url, {
          key: this.apiKey,
          strategy: 'desktop'
        });
      })
      // Save Desktop
      .then((results) => {
        console.log(`Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        this._saveFile(reportFolder, 'desktop.json', results);
      })
      // Get Mobile versions
      .then(() => {
        return psi(url, {
          key: this.apiKey,
          strategy: 'mobile'
        });
      })
      // Save Mobile
      .then((results) => {
        console.log(`Mobile: ${results.id} : ${results.ruleGroups.SPEED.score}`);
        //Should make filename unique for bad cleanups.
        this._saveFile(reportFolder, 'mobile.json', results);        
      });
  }

  /**
   * Handles the fetching of a single File entry in the PubContentListing results
   * 
   * @param {*} fileInfo 
   * @param {*} done 
   */
  _processSingleFile(fileInfo, done) {
    this.contentListingSvc.getPublishedFile('PageInstructions', fileInfo.FullWebPath)
      .then((fileJson) => {
        //extract pretty url
        let fetchURL = 'https://www.cancer.gov' + fileJson['cde:SinglePageAssemblyInstruction'].PrettyUrl[0];
        let contentID = fileJson['cde:SinglePageAssemblyInstruction'].ContentItemInfo[0].ContentItemID[0];
        let reportFolder = path.join(this.outputFolder, contentID);        
        return {                    
          fetchURL: fetchURL,
          contentId: contentID
        };
      })
      .then(this._getInsightsAndSave.bind(this))
      .then(() => {
        console.log(`Finished: ${fileInfo.FullWebPath}`)
        done();
      })
      .catch((err) => {
        console.log(err);
        done(err);
      })
  }

  /**
   * Processes a list of Files in a PubContentListing result
   * @param {*} files 
   */
  _processFiles(files) {
    return new Promise((resolve, reject) => {
      async.eachLimit(
        files,
        10,
        this._processSingleFile.bind(this),
        (err, res) => {
          if (err) { reject(err); }
          else { resolve(); }
        }
      );
    })
  }

  _processDir(dir, done) {
    this._processDirRec('/', dir, done);
  }

  _processDirRec(parent, dir, done) {
    let files = null;
    let dirs = null;

    let currPath = path.join(parent, dir);

    this.contentListingSvc.getItemsForPath('PageInstructions', currPath)
      .then((res) => {
        files = res.Files;
        dirs = res.Directories;
      })
      .then(() => {
        //Process files
        return this._processFiles(files);
      })
      .then(() => {
        return new Promise((resolve, reject) => {
        
          //Loop over each folder recursing calling processDir which will recurse the tree.
          async.eachLimit(
            dirs,
            2, //Limit to 2 as this will start exploding the further we go in the tree            
            this._processDir.bind(this, currPath), //Bind currPath so we can 
            (err, res) => {
              if (err) { reject(err); }
              else { resolve(); }            
            }
          )
        });
      })
      .then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });    
  }

  /**
   * Processes results from a call to PubContentListing with no path,
   * i.e. to the root.
   * 
   * @param {*} done 
   */
  _processRoot(done) {

    let files = null;
    let dirs = null;

    this.contentListingSvc.getItemsForPath('PageInstructions')
      .then((res) => {
        files = res.Files;
        dirs = res.Directories;
      })
      .then(() => {
        //Process files
        return this._processFiles(files);
      })
      .then(() => {
        return new Promise((resolve, reject) => {        
          //Loop over each folder recursing calling processDir which will recurse the tree.
          async.eachLimit(
            dirs,
            2, //Limit to 2 as this will start exploding the further we go in the tree
            this._processDir.bind(this),
            (err, res) => {
              if (err) { reject(err); }
              else { resolve(); }
            }
          )
        });
      })
      .then(() => {
        done();
      })
      .catch((err) => {
        done(err);
      });
  }

  process() {
    //Create folder.
    //process root
    return new Promise((resolve, reject) => {

      async.waterfall([
        // Create output folder.
        (next) => { fs.mkdir(this.outputFolder, next) },
        // Process the root
        (next) => { this._processRoot(next); }
      ], (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }
}

module.exports = InsightsProcessor;