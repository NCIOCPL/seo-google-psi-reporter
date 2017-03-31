'use strict';


const colors    = require('colors');
const moment    = require('moment');
const path      = require('path');
const Logger    = require('../lib/logger');

const InsightsProcessor = require('../lib/insights-processor'); 


module.exports = GetPageSpeedInsights;

let logger = new Logger({ name: "get-ps-insights" });

function GetPageSpeedInsights(program) {
  program
    .option('-k --key <key>', 'Google PageSpeed Insights key')
    .command('get-pagespeed-insights <outputFolder>')
    .version('0.0.1')
    .description(' \
        Tests CancerGov CDE Published Content Listing functionality. \
    ')
    .action((outputFolder, cmd) => {

      if (
        (!cmd.parent.server || cmd.parent.server == "" ) ||
        (!outputFolder || outputFolder == "")
      ) {
        logger.error('Invalid server or folder');
        program.help();
      }

      let timestamp = moment().format('YYYYMMDD_hhmmss');
      
      //The folder will be created by the processor
      let folder = path.join(process.cwd(), outputFolder, timestamp);

      logger.info(`Using ${folder} for output`);

      let processor = new InsightsProcessor(cmd.parent.server, {
        outputFolder: folder,
        insightsApiKey: cmd.parent.key
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