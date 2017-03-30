'use strict';


const colors    = require('colors');
const moment    = require('moment');
const path      = require('path');

const InsightsProcessor = require('../lib/insights-processor'); 


module.exports = GetPageSpeedInsights;



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
        console.error(colors.red('Invalid server or folder'));
        program.help();
      }

      let timestamp = moment().format('YYYYMMDD_hhmmss');
      
      //The folder will be created by the processor
      let folder = path.join(process.cwd(), outputFolder, timestamp);

      console.log(`Using ${folder} for output`);

      let processor = new InsightsProcessor(cmd.parent.server, {
        outputFolder: folder,
        insightsApiKey: cmd.parent.key
      });

      

      processor.process()
        .then(() => {
          //Exit
          console.log("Finished.  Exiting...")
          process.exit(0);
        })
        .catch((err) => {
          //Exit
          console.error(colors.red(err));
          console.error(colors.red("Errors occurred.  Exiting"));
          process.exit(1);
        }); 
    });
}