'use strict';


const colors    = require('colors');

const CGVContentListingSvc = require('../lib/CGV-content-listing-svc'); 
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

      console.log(`Server: ${cmd.parent.server}`);
      console.log(`Output Folder: ${outputFolder}`);

      let svc = new CGVContentListingSvc(cmd.parent.server);
      let processor = new InsightsProcessor(svc, outputFolder);

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