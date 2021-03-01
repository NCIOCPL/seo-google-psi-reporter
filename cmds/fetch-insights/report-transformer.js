
/**
 * Transforms a PSI report into an object with key metrics.
 *
 * @param {Object} report a PSI report
 */
const reportTransformer = ({id, url, strategy, status, report}) => {
  const transformedReport = {
    id: `${url}___${strategy}`,
    timestamp: report.lighthouseResult.fetchTime,
    url,
    strategy,
    version: report.lighthouseResult.lighthouseVersion,
    performance_score: report.lighthouseResult['performance'].score * 100,
    accessibility_score: report.lighthouseResult['accessibility'].score * 100,
    best_practice_score: report.lighthouseResult['best-practices'].score * 100,
    seo_score: report.lighthouseResult['seo'].score * 100,
    cumulative_layout_shift_score: {
      pct: report.originLoadingExperience['CUMULATIVE_LAYOUT_SHIFT_SCORE'].percentile * 100,
      category: report.originLoadingExperience['CUMULATIVE_LAYOUT_SHIFT_SCORE'].category
    },
    first_contentful_paint_score: {
      ms: report.originLoadingExperience['FIRST_CONTENTFUL_PAINT_MS'].percentile / 1000,
      category: report.originLoadingExperience['FIRST_CONTENTFUL_PAINT_MS'].category
    },
    first_input_delay_score: {
      ms: report.originLoadingExperience['FIRST_INPUT_DELAY_MS'].percentile / 1000,
      category: report.originLoadingExperience['FIRST_INPUT_DELAY_MS'].category
    },
    largest_contentful_paint_score: {
      ms: report.originLoadingExperience['LARGEST_CONTENTFUL_PAINT_MS'].percentile / 1000,
      category: report.originLoadingExperience['LARGEST_CONTENTFUL_PAINT_MS'].category
    }
  }
};

module.exports = reportTransformer;