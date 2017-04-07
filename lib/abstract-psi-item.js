'use strict';

const _       = require('lodash');

/**
 * Abstract class representing a PageSpeed Insights object from Google to be used for reporting purposes.  
 * The derrived classes should align to the different strategies. (e.g. desktop/mobile)
 * 
 * 
 * @class AbstractPSIItem
 */
class AbstractPSIItem {

  /**
   * Base constructor for a PageSpeed Insight
   * 
   * @param {any} url The URL of the page
   * @param {any} title The browser title of the page
   * @param {any} status The response status (should be 200)
   * @param {any} score The score for the strategy
   * @param {any} numberResources The number of resources (js, css, images) that the page has
   * @param {any} numberHosts The number of hosts those resources are spread across
   * @param {any} totalRequestBytes Total size of all request bytes sent by the page. (e.g. css + js + etc)
   * @param {any} numberStaticResources Number of static (i.e. cacheable) resources on the page.
   * @param {any} htmlResponseBytes Size of the HTML returned
   * @param {any} cssResponseBytes Size of the CSS used on the page
   * @param {any} imageResponseBytes Size of all the image resources
   * @param {any} javascriptResponseBytes Size of all the image resources
   * @param {any} otherResponseBytes Number of bytes not covered by html/css/image/js. 
   * @param {any} numberJsResources Number of JS resources on the page
   * @param {any} numberCssResources Number of CSS resources on the page
   * 
   * @memberOf AbstractPSIItem
   */
  constructor(
    url, 
    title, 
    status, 
    score,
    numberResources,
    numberHosts,
    totalRequestBytes,
    numberStaticResources,
    htmlResponseBytes,
    cssResponseBytes,
    imageResponseBytes,
    javascriptResponseBytes,
    otherResponseBytes,
    numberJsResources,
    numberCssResources
  ) {
    this.url = url;
    this.title = title;
    this.status = status;
    this.score = score;
    this.numberResources = numberResources;
    this.numberHosts = numberHosts;
    this.totalRequestBytes = totalRequestBytes;
    this.numberStaticResources = numberStaticResources;
    this.htmlResponseBytes = htmlResponseBytes;
    this.cssResponseBytes = cssResponseBytes;
    this.imageResponseBytes = imageResponseBytes;
    this.javascriptResponseBytes = javascriptResponseBytes;
    this.otherResponseBytes = otherResponseBytes;
    this.numberJsResources = numberJsResources;
    this.numberCssResources = numberCssResources;

    //Initialize a holder for keeping track of the speed rule keys.
    this.speedRuleKeys = [];
  }

  
  /**
   * Abstract method to get the fields of this item as a row of a spreadsheet.
   * NOTE: this should be implemented by the derrived class.
   *  
   * @memberOf AbstractPSIItem
   */
  getSheetRow() {
    throw new Error("Cannot call abstract method.  Implement getSheetRow in derrived class.");
  }

  /**
   * Extracts the ruleResults from the response.
   * This should really only be used from loadFromPSIResponse on the item being created
   * 
   * @param {any} response the PSI response
   * 
   * @memberOf AbstractPSIItem
  * */
  _loadSpeedRuleResults(response) {

    //Setting a shorter name here
    let ruleResults = response.formattedResults.ruleResults;

    _.keys(ruleResults)
      .forEach((key) => {
        //Let's make sure that the rule applies to speed.
        if (_.includes(ruleResults[key].groups, 'SPEED')) {
          this.speedRuleKeys.push(key);
          //Adds a element to "this" and store the impact of this score.
          this[key] = ruleResults[key].ruleImpact;

          //TODO: add additional logic for handling more specific rule reporting.
        }
      })
  }

  /**
   * Abstract method to get the headers of the spreadsheet.
   * NOTE: this should be implemented by the derrived class.
   * 
   * @static
   * 
   * @memberOf AbstractPSIItem
   */
  static getSheetHeaders() {
    throw new Error("Cannot call abstract method.  Implement getSheetHeaders in derrived class.");
  }

  /**
   * Abstract factory method to create an instance of a PSI item from a JSON response from Google
   * NOTE: this should be implemented by the derrived class.
   * 
   * @static
   * @param {any} response The PSI response.
   * 
   * @memberOf AbstractPSIItem
   */
  static loadFromPSIResponse(response) {
    throw new Error("Cannot call abstract method.  Implement loadFromPSIResponse in derrived class.");
  }

}

module.exports = AbstractPSIItem;