const Promise         = require('bluebird');
const Sitemapper      = require('sitemapper');
const async           = require('async');
const rp              = require('request-promise');

/**
 * Class that provides a method to extract HTML pages from an XML sitemap.
 */
class SitemapUrlExtractor {
    
    /**
     * Creates a new instance of the SitemapUrlExtractor
     * @param {*} server 
     * @param {*} storageProvider An instance of a Storage Provider class for storing the PSI information.
     * @param {*} options 
     */
    constructor(logger, server, options) {
        this.logger = logger;
        this.server = server;
    }

    /**
     * Returns a promise that will process a list of sitemap URLs and determine which urls are HTML pages, 
     * resolving the promise with only the HTML pages.
     * @param {*} sites 
     */
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
     * Fetches and Extracts the HTML Pages from a web site's sitemap.xml
     */
    extractPages() {
        //Setup the sitemap
        var sitemap = new Sitemapper({
            url: `${this.server}/sitemap.xml`,
            timeout: 120000
        });

        let promiseChain = 
            //Fetch Sitemap
            sitemap.fetch()
            //Check everypage in the sitemap to ensure HTML
            .then((res) => {
                return this._extractHtmlPages(res.sites);
            })
        
        return promiseChain;
    }
}

module.exports = SitemapUrlExtractor;