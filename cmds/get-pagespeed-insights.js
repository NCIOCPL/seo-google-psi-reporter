'use strict';


const colors    = require('colors');
const path      = require('path');
const Logger    = require('../lib/logger');
const config    = require('config');

const InsightsProcessor = require('../lib/insights-processor');
const SitemapUrlExtractor = require('../lib/sitemap-url-extractor');

module.exports = GetPageSpeedInsights;

let logger = new Logger({ 
  name: "get-ps-insights", 
  stream: process.stdout,
  level: "debug" }
);

function GetPageSpeedInsights(program) {
  program
    .command('get-pagespeed-insights')
    .version('0.0.1')
    .description(' \
        \n Using a website\'s sitemap.xml, this tool calls the Google PSI API to get page speed reports. \
        \n   <outputFolder> is the name of the parent folder where the output of this run will be stored.\n\n \
    ')
    .action((cmd) => {

      /*****************************************
       * Validate Easy Stuff
       *****************************************/
      if (!config.has('server') || (config.get('server') == "")) {
        logger.error('Configuration Issue: server is not set')
        process.exit(1);
      }

      if (!config.has('gapi_key') || (config.get('gapi_key') == "")) {
        logger.error('Configuration Issue: gapi_key is not set')
        process.exit(1);
      }

      if (
        !config.has("psi_batch_size") ||
        !config.has("psi_batch_sleep") ||
        !config.has("psi_max_async") ||
        !config.has("psi_max_retries") ||
        !config.has("psi_waittime_between_errors")
      ) {
        logger.error(`Invalid Config File.  Must contain psi_batch_size, psi_batch_sleep and psi_max_async!`);
        process.exit(1);
      }

      /************************************
       * Validate and Load Storage Providers
       ************************************/

      if (!config.has('storage_provider')) {
        logger.error('Configuration Issue: storage_provider is not set')
        process.exit(1);
      }      

      if (!config.has('storage_provider_config')) {
        logger.error('Configuration Issue: storage_provider_config is not set')
        process.exit(1);
      }      

      let storageProviderName = config.get('storage_provider');
      let storageProviderConfig = config.get('storage_provider_config');

      let storageProviderModulePath = path.join(__dirname, '..', 'lib', 'storage-providers', storageProviderName);
      let storageProviderModule = null;

      //Load the provider Module
      try {
        storageProviderModule = require(storageProviderModulePath);
      } catch(err) {
        logger.error(`Could not load storage provider, ${storageProviderName}. ${err.message}`);
        process.exit(1);
      }
      
      //Validate the config
      let configErrors = storageProviderModule.ValidateConfig(storageProviderConfig);
      if (configErrors.length > 0) {
        logger.error('Configuration Errors Detected');
        configErrors.forEach(err => {
          logger.error(err);
        });  
        process.exit(1);
      }

      //Create an storageProviderInstance
      storageProviderModule.GetProviderInstance(logger, storageProviderConfig)
        // Then create a processor and get a promise for the processing of the instance
        .then((storageProviderInstance) => {

          let sitemapExtractor = new SitemapUrlExtractor(
            logger, 
            config.get("server"),
            {}
          );

          let processor = new InsightsProcessor(
            logger,            
            storageProviderInstance,
            {
              insightsApiKey: config.get("gapi_key"),
              psi_batch_size: config.get("psi_batch_size"),
              psi_batch_sleep: config.get("psi_batch_sleep"),
              psi_max_async: config.get("psi_max_async"),
              psi_max_retries: config.get("psi_max_retries"),
              psi_waittime_between_errors: config.get("psi_waittime_between_errors")
            }
          );

          //Cal the sitemap extractor THEN the processor's process method (which takes in a list of URLs)
          //return sitemapExtractor.extractPages()
          //    .then(processor.process.bind(processor))            
          return processor.process(['https://www.cancer.gov/about-cancer']);
        })
        // Then when processing is done, exit.
        .then(() => {          
          //Exit
          logger.info("Finished.  Exiting...")
          process.exit(0);
        })
        //Otherwise, catch any fatal error and exit.
        .catch((err) => {  
          logger.error(`Fatal Error Occurred in get-pagespeed-insights.`)                
          logger.error(err);
          logger.error("Errors occurred.  Exiting");
          process.exit(2);
        });

    });
}