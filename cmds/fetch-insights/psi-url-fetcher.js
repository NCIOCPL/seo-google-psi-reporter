const httpsAgent = require ('https').Agent;
const axios = require('axios');
const Qs = require('qs');

/**
 * Class handles making requests of the Google PSI API
 */
class PsiUrlFetcher {

  /**
   * Creates an instance of a PsiUrlFetcher class
   * @param {Agent} agent - an https compatible agent 
   * @param {Object} options - The options for accessing the API
   * @param {string} options.apiUrl - the URL for the API. (Default: https://www.googleapis.com/pagespeedonline/v5/runPagespeed)
   * @param {string} options.apikey - a Google API key
   */
  constructor({
    agent = new httpsAgent(),
    apiUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
    apikey
  }) {

    if (!apikey || apikey === '') {
      throw new Error('API Key is required.');
    }
    this.apikey = apikey;

    if (agent === null) {
      throw new Error('Https agent is required.');
    }

    this.client = axios.create({
      baseURL: apiUrl,
      httpsAgent: agent,
      // `paramsSerializer` is an optional function in charge of serializing `params`
      // (e.g. https://www.npmjs.com/package/qs, http://api.jquery.com/jquery.param/)
      paramsSerializer: function (params) {
        return Qs.stringify(params, {arrayFormat: 'repeat'})
      }
    });

  }

  /**
   * Fetches a url.
   * 
   * Note: This method does not care about rate limits, you will need to handle that
   * outside the class.
   * 
   * @param {string} url 
   * @param {Object} options - the options to send with the request
   * @param {Array<string>} options.category - The lighthouse category to run.
   * @param {string} options.strategy - The analytis strategy. DESKTOP or MOBILE
   */
  async fetch(url, {
    category = [ 'ACCESSIBILITY', 'BEST_PRACTICES', 'PERFORMANCE', 'PWA', 'SEO' ],
    strategy = 'DESKTOP'
  } = {}) {
    try {
      const res = await this.client.get('/', {
        params: {
          url,
          category,
          strategy,
          key: this.apikey
        }
      });

      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error(`Status ${res.status} returned for ${url} and strategy ${strategy}`);
      }
    } catch (err) {
      console.error(`Error fetching ${url}`);
      console.error(err.message);
      throw err;
    }
  }

}

module.exports = PsiUrlFetcher;