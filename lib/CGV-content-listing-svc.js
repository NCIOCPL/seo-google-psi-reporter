'use strict';

const rp          = require('request-promise');
const url         = require('url');
const xml2js      = require('xml2js');
const parser      = new xml2js.Parser();

const AbstractContentListingSvc = require('./abstract-content-listing-svc');

class CGVContentListingSvc extends AbstractContentListingSvc {

  constructor(server, options) {
    super();

    //assumes protocol://server
    this.server = server;
  }

  _transformXml2Js(body, response, resolveWithFullResponse) {
    return new Promise((resolve, reject) => {
      parser.parseString(body, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      })
    });
  }

  _getXmlInstruction(path) {
    let options = {
      uri: `${this.server}${path}`,
      transform: this._transformXml2Js.bind(this)
    };

    return rp(options);
  }

  getPublishedFile(root, path) {
    switch(root.toLowerCase()) {
      case 'pageinstructions': return this._getXmlInstruction(path);
      default : throw Error("This published file type is not supported.") 
    }
  }

  listAvailablePaths() {

  }


  getItemsForPath(root, path = '') {
    let options = {
      uri: `${this.server}/PublishedContent/list`,
      qs: {
        root: root,
        path: path,
        fmt: 'json'
      },
      json: true
    };

    return rp(options);
  }

}

module.exports = CGVContentListingSvc;