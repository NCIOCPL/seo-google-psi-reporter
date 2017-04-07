'use strict';

const colors          = require('colors');
const psi             = require('psi');

module.exports = TestPSI;

function TestPSI(program) {
  program
    .option('-k --key <key>', 'Google PageSpeed Insights key')
    .command('test-psi <url>')
    .version('0.0.1')
    .description(' \
        Tests CancerGov CDE Published Content Listing functionality. \
    ')
    .action((url, cmd) => {

      if (!cmd.parent.key || cmd.parent.key == "") {              
        logger.error('Invalid key');
        program.help();      
      }

      psi(url, {
          key: cmd.parent.key,
          strategy: 'mobile'
      })
        .then((res) => {
        console.log(res); 
        })
        .catch((err)=> {
          console.log(err);
        })
        ;
    });
}