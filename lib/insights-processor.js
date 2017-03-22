'use strict';

const async           = require('async');
const fs              = require('fs');
const Promise         = require('bluebird');
const psi             = require('psi');

class InsightsProcessor {

  constructor(contentListingSvc, options) {
    this.contentListingSvc = contentListingSvc;
    this.outputFolder = options.outputFolder;
    this.apiKey = options.insightsApiKey;
    console.log(this.apiKey);
  }

  _getInsightsAndSave(url) {
    console.log(`Insights for ${url}`)
    return Promise.resolve()
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
      });
  }

  _processSingleFile(fileInfo, done) {
    this.contentListingSvc.getPublishedFile('PageInstructions', fileInfo.FullWebPath)
      .then((fileJson) => {
        //extract pretty url
        let fetchURL = 'https://www.cancer.gov' + fileJson['cde:SinglePageAssemblyInstruction'].PrettyUrl[0];
        return fetchURL;
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

  _processFiles(files, done) {
      async.eachLimit(
        files,
        10,
        this._processSingleFile.bind(this),
        done
      )
  }

  _processRoot(done) {
    this.contentListingSvc.getItemsForPath('PageInstructions')
      .then((res) => {
        
        //Process Files
        //This exits
        this._processFiles(res.Files, done);

        //then dirs

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