'use strict';

const async           = require('async');
const Promise         = require('bluebird');
const psi             = require('psi');

class InsightsProcessor {

  constructor(contentListingSvc, options) {
    this.contentListingSvc = contentListingSvc;
    this.outputFolder = options.outputFolder;
    this.apiKey = options.insightsApiKey;
  }

  _getInsightsAndSave(url) {
    console.log(`Insights for ${url}`)
    return Promise.resolve()
      .then(() => {
        return psi(url, {
          key: this.apiKey,
          strategy: 'desktop'
        });
      })
      .then((results) => {
        console.log(`Desktop: ${results.id} : ${results.ruleGroups.SPEED.score}`);
      })
      .then(() => {
        return psi(url, {
          key: this.apiKey,
          strategy: 'mobile'
        });
      })
      .then((results) => {
        console.log(`Mobile: ${results.id} : ${results.ruleGroups.SPEED.score}`);
      });
  }

  _processSingleFile(fileInfo, done) {
    this.contentListingSvc.getPublishedFile('PageInstructions', fileInfo.FullWebPath)
      .then((fileJson) => {
        //extract pretty url
        return 'https://www.cancer.gov' + fileJson['cde:SinglePageAssemblyInstruction'].PrettyUrl[0];
      })
      .then(this._getInsightsAndSave.bind(this))
      .then(() => {
        console.log(`Finished: ${fileInfo.FullWebPath}`)
        done();
      })
      .catch((err) => {
        done(err);
      })
  }

  _processFiles(files, done) {
      async.eachLimit(
        files,
        5,
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
        //Create output folder.
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