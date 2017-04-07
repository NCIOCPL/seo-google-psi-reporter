'use strict';


const Logger    = require('../lib/logger');
const path      = require('path');

const InsightsReportProcessor = require('../lib/insights-report-processor'); 

module.exports = ExportReport;

let logger = new Logger({ name: "export-report" });

function ExportReport(program) {
  program
    .command('export-report <inputFolder> <outputFile>')
    .version('0.0.1')
    .description(' \
        Tests CancerGov CDE Published Content Listing functionality. \
    ')
    .action((inputFolder, outputFile, cmd) => {
      
      //The folder will be created by the processor
      let folder = path.join(process.cwd(), inputFolder);

      logger.info(`Using ${folder} for output`);

      let processor = new InsightsReportProcessor({
        inputFolder: folder,
        outputFile: outputFile
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