const httpsAgent = require ('https').Agent;
const axios = require('axios');
var xml2js = require('xml2js');

/**
 * This is a tool to scrape a site's site map, as well as enrich the URLs so
 * they can be filtered. Basically a 
 */
class SitemapScraper {

  /**
   * Creates a new instance of the sitemap scraper.
   *
   * @param {Object} options
   *  
   */
  constructor({
    agent = new httpsAgent(),
    maxConcurrent = 5,
    timeout = 30000,
    interval = 1000,
    intervalCap = 45
  } = {}) {

    if (agent === null) {
      throw new Error('Https agent is required.');
    }
    this.client = axios.create({
      httpsAgent: agent
    });

  }

  /**
   * Fetches the sitemap
   *
   * @param {string} sitemapUrl - the URL of the sitemap
   */
  async getSitemap(sitemapUrl) {
    try {
      const res = await this.client.get(sitemapUrl);

      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error(`Unexpected Status ${res.status} returned for ${sitemapUrl}`);
      }
    } catch (err) {
      console.error(`Error fetching ${sitemapUrl}`);
      throw err;      
    }
  }

  /**
   * Fetches the URLs from the sitemap, additionally testing the content-type
   * of each page.
   * @param {*} sitemapUrl 
   * @param {*} excludeUrls 
   */
  async fetch(sitemapUrl, excludeUrls=[]) {
    if (sitemapUrl === null || sitemapUrl === '') {
      throw new Error('Sitemap URL is required to fetch a sitemap');
    }

    const sitemapXml = await this.getSitemap(sitemapUrl);

    try {
      const data = await xml2js.parseStringPromise(sitemapXml);

      if (data && data.urlset && data.urlset.url) {
        return data.urlset.url.map(site => site.loc && site.loc[0]);
      } else {
        throw new Error(`Unsupported sitemap, ${sitemapUrl}, maybe this is an index?`);
      }
    } catch (err) {
      console.error(`Parsing sitemap ${sitemapUrl}`);
      throw err;
    }
  }

}

module.exports = SitemapScraper;