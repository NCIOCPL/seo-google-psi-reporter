'use strict';

const AbstractPSIItem     = require('./abstract-psi-item');

class DesktopPSIItem extends AbstractPSIItem {
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
    super(
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
    );
  }

  getSheetRow() {
    return [
      this.url,
      this.title,
      this.status,
      this.score,
      this.numberResources,
      this.numberHosts,
      this.totalRequestBytes,
      this.numberStaticResources,
      this.htmlResponseBytes,
      this.cssResponseBytes,
      this.imageResponseBytes,
      this.javascriptResponseBytes,
      this.otherResponseBytes,
      this.numberJsResources,
      this.numberCssResources
    ]
  }

  static getSheetHeaders() {
    
  }

  static loadFromPSIResponse(response) {

    let speedScore = -1;
    if (response.ruleGroups["SPEED"]) {
      speedScore = response.ruleGroups["SPEED"].score;
    }

    let item = new DesktopPSIItem(
      response.id,
      response.title,
      response.responseCode,
      speedScore,
      response.pageStats.numberResources,
      response.pageStats.numberHosts,
      response.pageStats.totalRequestBytes,
      response.pageStats.numberStaticResources,
      response.pageStats.htmlResponseBytes,
      response.pageStats.cssResponseBytes,
      response.pageStats.imageResponseBytes,
      response.pageStats.javascriptResponseBytes,
      response.pageStats.otherResponseBytes,
      response.pageStats.numberJsResources,
      response.pageStats.numberCssResources
    );

    item._loadSpeedRuleResults(response);
    return item;
  }
  
}

module.exports = DesktopPSIItem;