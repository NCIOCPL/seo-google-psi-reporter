/**
 * Breaks an array into multiple batches.
 *
 * @param {Array} arrayToBatch 
 * @param {number} batchSize 
 */
const batchArray = (arrayToBatch, batchSize) => {
  // We should do this in batches, do something like 10-20 URLs,
  // save them all at the end of the batch
  const batch = arrayToBatch
    .reduce((ac, curr) => {
      const lastIndex = ac.length - 1;
      // Very first item
      if (lastIndex === -1) {
        return [[curr]];
      }

      if (ac[lastIndex].length < batchSize) {
        // Add to last batch
        return [
          ...(ac.slice(0,lastIndex)),
          [...ac[lastIndex], curr]
        ]
      } else {
        // Make new batch
        return [
          ...ac,
          [curr]
        ]
      }
    }, []);
  return batch;
};

/**
 * Helper function for date formatting.
 */
const pad = (number) => {
  if (number < 10) {
    return '0' + number;
  }
  return number;
}

/**
 * Helper function to resolve the home directory in a path.
 * @param {string} pathname the path to resolve
 */
const replaceHomeDir = (pathname) => {
  if (pathname === null || pathname === '') {
    throw new Error('Pathname is required.')
  }

  if (pathname[0] === '~') {
    return path.join(process.env.HOME, pathname.slice(1));
  }
  return pathname;
};

module.exports = {
  batchArray,
  pad,
  replaceHomeDir
};