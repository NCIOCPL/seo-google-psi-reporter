'use strict';

const colors    = require('colors');

const CGVContentListingSvc = require('../lib/CGV-content-listing-svc'); 

module.exports = TestCGVContentListing;

function TestCGVContentListing(program) {
  program
    .command('test-cgv-content-listing')
    .version('0.0.1')
    .description(' \
        Tests CancerGov CDE Published Content Listing functionality. \
    ')
    .action((cmd) => {

      if (
        (!cmd.parent.server || cmd.parent.server == "" )
      ) {
        console.error(colors.red('Invalid server'));
        program.help();
      }

      console.log(`Server: ${cmd.parent.server}`);

      try {
        let svc = new CGVContentListingSvc(cmd.parent.server);

        svc.getItemsForPath('PageInstructions')
          //do something with results
          .then((listing) => {
            console.log(listing);
            console.log("Should fall to next");
            return listing;
          })
          //Fetch first file.
          .then((listing) => {
            console.log("returning get PublishedFile");
            return svc.getPublishedFile('PageInstructions', listing.Files[0].FullWebPath)
          })
          //Do something with first instruction
          .then((publishedFile) => {

            console.log(publishedFile['cde:SinglePageAssemblyInstruction'].PrettyUrl[0]);

            //Exit
            console.log("Finished.  Exiting...")
            process.exit(0);

          })
          .catch((err) => {
            throw err;
          });
                  
      } catch (err) {
        console.error(colors.red(err));
        console.error(colors.red("Errors occurred.  Exiting"));
        process.exit(1);
      }
    });
}