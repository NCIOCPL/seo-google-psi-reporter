'use strict';

const async           = require('async');
const psi             = require('psi');

class InsightsProcessor {

  constructor(contentListingSvc, options) {
    this.contentListingSvc = contentListingSvc;
    this.outputFolder = options.outputFolder;
    this.apiKey = options.insightsApiKey;
  }


  _processSingleFile(fileInfo, done) {
    this.contentListingSvc.getPublishedFile('PageInstructions', fileInfo.FullWebPath)
      .then((fileJson) => {
        //extract pretty url
        return fileJson['cde:SinglePageAssemblyInstruction'].PrettyUrl[0];
      })
      .then((prettyUrl) => {
        return psi(`https://www.cancer.gov${prettyUrl}`)
      })
      .then((pageSpeedInfo) => {
        console.log(pageSpeedInfo);
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