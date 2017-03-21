'use strict';

const rp     = require('request-promise');
const url         = require('url');

const AbstractContentListingSvc = require('./abstract-content-listing-svc');

class CGVContentListingSvc extends AbstractContentListingSvc {

  constructor(server, options) {
    super();

    //assumes protocol://server
    this.server = server;
  }

  getPublishedFile(path) {

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