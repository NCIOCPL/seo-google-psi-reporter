#cgv-pagespeed-insights

## Description

Tool to get Google PageSpeed Insights for all pages in a sitemap.xml file.

## Required Software
* Node v6.x
* npm 3.x
* bunyan installed globally

## Usage

To install seo-google-psi-reporter from npm, run the following in this folder:

```
$ npm install -g bunyan
$ npm install
```

### To scrape down a collection of insights from Google Pagespeed Insights:

#### NOTES:
* You will need to generate a Google API key if you do not have one.  Follow the instructions at [Google](https://developers.google.com/speed/docs/insights/v2/first-app#APIKey) for more information.*
* The API has a limit of 100 req/100 sec.  This makes it somewhat tricky to ensure max throughput for the insights-processor.  The processor will batch up the URLs into groups of _psi\_batch\_size_, default 45.  It then requests the results of both the mobile and desktop strategies for each URL allowing a maximum of _psi\_max\_async_ requests, default 20.  The processing will pause _psi\_batch\_sleep_ milliseconds, default 100001, before moving to the next batch group.  You can tweak these numbers to maximize throughput. 


#### To scrape the insights
```
  Usage: bin/seo-google-psi-reporter --key <key> --server <rootURL> get-pagespeed-insights <outputFolder> | bunyan
```
Where:
* key - The Google API key for accessing the Page Speed Insights
* rootURL - the site URL (with protocol) of the site to gather insights for
* outputFolder - the parent folder where the PSI results files will be stored.

*Example:*
```
bin/seo-google-psi-reporter --key abcdef --server https://www.cancer.gov get-pagespeed-insights ./output | bunyan
```

#### To generate a report
```
  Usage: bin/seo-google-psi-reporter export-report <inputFolder> <outputFile> | bunyan
```
Where:
* inputFolder - The timestamped folder that the get-pagespeed-insights command generates
* outputFile - The name of the XLSX file to be generated

*Example:*
```
bin/seo-google-psi-reporter export-report ./output/20170619_053121 output.xlsx | bunyan
```


## Author

Bryan Pizzillo

## Acknowledgments

Built using [generator-commader](https://github.com/Hypercubed/generator-commander).
