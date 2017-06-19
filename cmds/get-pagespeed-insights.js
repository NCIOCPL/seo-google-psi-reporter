'use strict';


const colors    = require('colors');
const moment    = require('moment');
const path      = require('path');
const Logger    = require('../lib/logger');

const InsightsProcessor = require('../lib/insights-processor'); 
const processor_config  = require('../config.json'); 

module.exports = GetPageSpeedInsights;

let logger = new Logger({ name: "get-ps-insights" });

function GetPageSpeedInsights(program) {
  program
    .option('-k --key <key>', 'Google PageSpeed Insights key')
    .option('-s --server <server>', 'Server')
    .command('get-pagespeed-insights <outputFolder>')
    .version('0.0.1')
    .description(' \
        \n Using a website\'s sitemap.xml, this tool calls the Google PSI API to get page speed reports. \
        \n   <outputFolder> is the name of the parent folder where the output of this run will be stored.\n\n \
    ')
    .action((outputFolder, cmd) => {

      if (
        (!cmd.parent.server || cmd.parent.server == "" ) ||
        (!outputFolder || outputFolder == "")
      ) {
        logger.error('Invalid server or folder');
        program.help();
        process.exit(1);
      }

      let timestamp = moment().format('YYYYMMDD_hhmmss');
      
      //The folder will be created by the processor
      let folder = path.join(process.cwd(), outputFolder, timestamp);

      logger.info(`Using ${folder} for output`);

      /*
        "psi_batch_size": 45,
    "psi_batch_sleep": 100001,
    "psi_max_async": 20
    */
      if (
        !processor_config["psi_batch_size"] ||
        !processor_config["psi_batch_sleep"] ||
        !processor_config["psi_max_async"] 
      ) {
        logger.error(`Invalid Config File.  Must contain psi_batch_size, psi_batch_sleep and psi_max_async!`);
        process.exit(2);
      }


      let processor = new InsightsProcessor(cmd.parent.server, {
        outputFolder: folder,
        insightsApiKey: cmd.parent.key,
        psi_batch_size: processor_config["psi_batch_size"],
        psi_batch_sleep: processor_config["psi_batch_sleep"],
        psi_max_async: processor_config["psi_max_async"]
      });      

      processor.process()
        .then(() => {
          //Exit
          logger.info("Finished.  Exiting...")
          process.exit(0);
        })
        .catch((err) => {
          //Exit
          logger.error(err);
          logger.error("Errors occurred.  Exiting");
          process.exit(1);
        }); 
    });
}