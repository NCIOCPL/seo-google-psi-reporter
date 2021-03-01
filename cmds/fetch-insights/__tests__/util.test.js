const { batchArray } = require('../util');

describe('Util', () => {

  test('batchArray works empty array', () => {
    const expected = [];
    const actual = batchArray([], 5);
    expect(actual).toEqual(expected);
  });

  test('batchArray works less than batch', () => {
    const expected = [
      [1,2,3]
    ];
    const actual = batchArray([1,2,3], 5);
    expect(actual).toEqual(expected);
  });

  test('batchArray works more than batch', () => {
    const expected = [
      [1,2,3,4,5],
      [6,7,8,9,10]
    ];
    const actual = batchArray([1,2,3,4,5,6,7,8,9,10], 5);
    expect(actual).toEqual(expected);
  });

})