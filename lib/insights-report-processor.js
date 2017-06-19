'use strict';

const _               = require('lodash');
const async           = require('async');
const fs              = require('fs');
const Logger          = require('./logger');
const Promise         = require('bluebird');
const retry           = require('bluebird-retry');
const path            = require('path');
const rp              = require('request-promise');
const Sitemapper      = require('sitemapper');
const uuidV4          = require('uuid/v4');
const walk            = require('walk');
const XLSX            = require('xlsx');


const DesktopPSIItem  = require('../lib/desktop-psi-item');
const MobilePSIItem  = require('../lib/mobile-psi-item');

const BATCH_SIZE = 45; // Note: 2 strategies means batch_size * 2 req/batch

/**
 * Class representing the Insights report generator.
 */
class InsightsReportProcessor {

  /**
   * Creates a new instance of a InsightsReportProcessor
   * @param {*} options 
   */
  constructor(options) {
    this.logger = new Logger({ name: 'insights-report-processor'});
    this.inputFolder = options.inputFolder;
    this.outputFile = options.outputFile;

    //Pages are simple in that they will only be encountered once
    //This is to report page scores
    this.desktopPageReport = [];
    this.mobilePageReport = [];

    //Images need to be found later so they can be updated.
    //This is to report offending images
    this.imageReport = {};
    this.cacheReport = {};
  }

  /**
   * Process a PSI output for a URL & Strategy saved by the InsightsProcessor
   * @param {*} root 
   * @param {*} fileStats 
   * @param {*} next 
   */
  _processFile(root, fileStats, next) {

    //Deal, and move on.
    let filePath = path.join(root, fileStats.name);

    try {      
      let json = require(filePath);

      let psiItem = null;

      if (fileStats.name == 'desktop.json') {
        psiItem = DesktopPSIItem.loadFromPSIResponse(json);
        this.desktopPageReport.push(psiItem);      
      } else if (fileStats.name = 'mobile.json') {
        psiItem = MobilePSIItem.loadFromPSIResponse(json);
        this.mobilePageReport.push(psiItem);        
      } else {
        this.logger.info(`Unknown filename type ${fileStats.name}`);
        throw new Error(`Unknown filename type ${fileStats.name}`);
      }

      //Iterate over unoptimized images adding/updating to the global record.
      psiItem.unoptimizedImages.forEach((img) => {

        if (!this.imageReport[img.url]) {
          this.imageReport[img.url] = {
            url: img.url,
            count: 0,
            bytes_saved: img.bytes_saved,
            pct_saved: img.pct_saved            
          }          
        }
        this.imageReport[img.url].count++;
      });

      psiItem.uncachedResources.forEach((resource) => {

        if (!this.cacheReport[resource]) {
          this.cacheReport[resource] = {
            url: resource,
            count: 0            
          }          
        }
        this.cacheReport[resource].count++;
      });
      
      //Move on to the next item
      next();
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  /**
   * Walk the input folder and process the files encountered
   */
  _processFiles() {
    let hasErrors = false;
    return new Promise((resolve, reject) => {
      walk.walk(this.inputFolder, {})
        .on("file", this._processFile.bind(this))
        .on("errors", (root, nodeStatsArray, next) => {
          //Should we return?
          this.logger.error("Errors occurred");
          this.hasErrors = true;
          next();
        })
        .on("end", () => {
          if (hasErrors) {
            reject(new Error("PROBLEM"));
          } else {
            resolve();
          }
        });
    });
  }

  /**
   * 
   * 
   * @param {any} data 
   * @param {any} cols
   * @param {any} ws
   * 
   * @memberOf InsightsReportProcessor
   */
  _addRowsToSheet(data, cols, ws) {
    //Need to output header row and not break.
    
    let range = {s: {c:0, r:0}, e: {c:0, r:0 }};

    for (let C = 0; C < cols.length; C++) {
      if (range.e.c < C) range.e.c = C;
      var cell = { v: cols[C] };
      /* create the correct cell reference */
      var cell_ref = XLSX.utils.encode_cell({c:C,r:0});
      cell.t = 's';
      /* add to structure */
      ws[cell_ref] = cell;      
    }

    for(let idx = 0; idx != data.length; ++idx) {
      let R = idx + 1; //The row num should be offset by 1
      if (range.e.r < R) range.e.r = R;
      for(var C = 0; C != cols.length; ++C) {
        if (range.e.c < C) range.e.c = C;

        /* create cell object: .v is the actual data */
        var cell = { v: data[idx][cols[C]] };
        if(cell.v == null) continue;

        /* create the correct cell reference */
        var cell_ref = XLSX.utils.encode_cell({c:C,r:R});

        /* determine the cell type */
        if(typeof cell.v === 'number') cell.t = 'n';
        else if(typeof cell.v === 'boolean') cell.t = 'b';
        else cell.t = 's';

        /* add to structure */
        ws[cell_ref] = cell;
      }            
    }

    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  /**
   * Adds the mobile items to the workbook
   * 
   * 
   * @memberOf InsightsReportProcessor
   */
  _addMobileSheet(wb) {
    let ws_name = "Mobile";
    let ws = {};

    this._addRowsToSheet(
      this.mobilePageReport,
      [    
        "url", "title", "status", "score", "usabilityScore", "numberResources", "numberHosts",
        "totalRequestBytes", "numberStaticResources", "htmlResponseBytes",
        "cssResponseBytes", "imageResponseBytes", "javascriptResponseBytes",
        "otherResponseBytes", "numberJsResources", "numberCssResources",
        "AvoidLandingPageRedirects", "EnableGzipCompression", "LeverageBrowserCaching",
        "MainResourceServerResponseTime", "MinifyCss", "MinifyHTML", "MinifyJavaScript",
        "MinimizeRenderBlockingResources", "OptimizeImages", "PrioritizeVisibleContent"
      ],
      ws
    );

    /* add worksheet to workbook */
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;
  }

  /**
   * Adds the desktop items to the sheet.
   * 
   * @param {any} wb
   * 
   * @memberOf InsightsReportProcessor
   */
  _addDesktopSheet(wb) {
    let ws_name = "Desktop";
    let ws = {};

    this._addRowsToSheet(
      this.desktopPageReport,
      [    
        "url", "title", "status", "score", "numberResources", "numberHosts",
        "totalRequestBytes", "numberStaticResources", "htmlResponseBytes",
        "cssResponseBytes", "imageResponseBytes", "javascriptResponseBytes",
        "otherResponseBytes", "numberJsResources", "numberCssResources",
        "AvoidLandingPageRedirects", "EnableGzipCompression", "LeverageBrowserCaching",
        "MainResourceServerResponseTime", "MinifyCss", "MinifyHTML", "MinifyJavaScript",
        "MinimizeRenderBlockingResources", "OptimizeImages", "PrioritizeVisibleContent"
      ],
      ws
    );


    /* add worksheet to workbook */
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;
  }

  /**
   * Adds additional sheets to the report
   * 
   * @param {any} wb
   * 
   * @memberOf InsightsReportProcessor
   */
  _addAdditionalSheets(wb) {

    let sheets = [
      {
        sheetName: 'UnoptimizedImages',
        data: _.values(this.imageReport),
        cols: ['url', 'count', 'bytes_saved', 'pct_saved']
      },
      {
        sheetName: 'UncachedResources',
        data: _.values(this.cacheReport),
        cols: ['url', 'count']
      }      
    ];

    sheets.forEach((sheet) => {
      let ws_name = sheet.sheetName;
      let ws = {};

      this._addRowsToSheet(
        sheet.data,
        sheet.cols,
        ws
      );

      /* add worksheet to workbook */
      wb.SheetNames.push(ws_name);
      wb.Sheets[ws_name] = ws;
    });

  }


  /**
   * Outputs the workbook.
   * 
   * @returns
   * 
   * @memberOf InsightsReportProcessor
   */
  _outputWorkbook() {
    return new Promise((resolve, reject) => {

      let wb = {};
      wb.Sheets = {};
      wb.SheetNames = [];

      this._addDesktopSheet(wb);
      this._addMobileSheet(wb);
      this._addAdditionalSheets(wb);

      try {
        /* write file */
        XLSX.writeFile(wb, this.outputFile);
      } catch (err) {
        reject(err);
      }
      resolve();
    });
  }

  /**
   * Main entry point
   * 
   * @returns
   * 
   * @memberOf InsightsReportProcessor
   */
  process() {
    return this._processFiles()
      .then(() => {
        return this._outputWorkbook();
      });
    //Chain other steps?
  }
}

module.exports = InsightsReportProcessor;