'use strict';

const colors    = require('colors');

const CGVContentListingSvc = require('../lib/CGV-content-listing-svc'); 

module.exports = TestCGVContentListing;

function TestCGVContentListing(program) {
console.log(program);
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

        console.log("creating server");

        let svc = new CGVContentListingSvc(cmd.parent.server);

        console.log("created server");

        svc.getItemsForPath('PageInstructions')
          .then((listing) => {
            console.log(listing);

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