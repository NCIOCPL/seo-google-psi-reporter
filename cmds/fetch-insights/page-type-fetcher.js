const httpsAgent = require ('https').Agent;
const axios = require('axios');
const {default: PQueue} = require('p-queue');

/**
 * This class is a fetcher for getting the type of page, and HTTP status
 */
class PageTypeFetcher {

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

        // PSI currently has a 400 req/100 seconds
    // Max 25,000 req/day resetting at 3am Eastern time
    this.queue = new PQueue({
      concurrency: maxConcurrent,
      timeout,
      interval,
      intervalCap,
      carryoverConcurrencyCount: true
    })
  }

  /**
   * Gets additional page information for a URL.
   * 
   * NOTE: This should be used as a mapping function.
   * 
   * @param {string} url the URL to get info for.
   * 
   * @returns {Object} The url, status and content-type. 
   */
  async getPageInfo(url) {
    // REMEMBER: this.queue.add cannot throw!!! The await breaks and chaos ensues.
    // So getPageInfo should NEVER throw

    console.log(`Fetching info for ${url}.`);
    try {
      const res = await this.client.head(url, {
        maxRedirects: 0 // Don't follow redirects
      });
      if (res.status === 200) {
        return {
          url: url,
          status: res.status,
          contenttype: res.headers['content-type']
        }
      } else {
        return {
          url: url,
          status: res.status,
          contenttype: 'unknown'
        }
      }
    } catch (err) {
      if (err.response) {
        // If we are getting 500 errors we should know.
        // TODO? If there are too many 500 errors we should throw an exception.
        if (err.response.status >= 500) {
          console.error(`ERROR fetching url info ${url}`);
        }

        return {
          url: url,
          status: err.response.status,
          contenttype: 'unknown'
        }
      } else {
        // This is a bad error. We did not even get a response.
        console.error(`Bad response during fetch page information for ${url}`);
        console.error(err.message);
        return {
          url: url,
          status: -1,
          contenttype: 'unknown'
        }
      }
    }
  }

  /**
   * Makes HEAD requests to determine status and content type.
   *
   * @param {Array<string>} urlsToFetch Urls to fetch. 
   */
  async fetch(urlsToFetch) {
    // Now we have a list of urls, we need to enqueue them for fetching.
    const urls = [];
    for (let i=0; i<urlsToFetch.length; i++) {
      const url = urlsToFetch[i];
      this.queue.add(async () => {
        // REMEMBER: this.queue.add cannot throw!!! The await breaks and chaos ensues.
        // So getPageInfo should NEVER throw
        urls.push(await this.getPageInfo(url));
      });
    }

    // Wait for current batch to process
    await this.queue.onIdle();

    return urls;
  }

}

module.exports = PageTypeFetcher;