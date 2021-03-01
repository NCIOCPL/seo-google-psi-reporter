const PsiProcessor = require('../psi-processor');
const PsiUrlFetcher = require('../psi-url-fetcher');

jest.mock('../psi-url-fetcher');

describe('PsiProcessor', () => {

  beforeEach(() => {
    PsiUrlFetcher.mockClear();
  })

  test('Fetches Urls with defaults', async() => {
    PsiUrlFetcher.mockImplementation(() => {
      return {
        fetch: (url, ) => {
          return { a: "1" };
        }
      }
    });

    const processor = new PsiProcessor(new PsiUrlFetcher());

    const items = [
      { id: 1, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 2, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'MOBILE', errormessage: null, report: null },
      { id: 3, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 4, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'MOBILE', errormessage: null, report: null },
    ]

    const expected = {
      successes: [
        { item: items[0], report: { a: "1" }},
        { item: items[1], report: { a: "1" }},
        { item: items[2], report: { a: "1" }},
        { item: items[3], report: { a: "1" }},
      ],
      failures: []
    };

    const actual = await processor.processGroup(items);
    expect(actual).toEqual(expected);
  });

  test('Fetches Urls with defaults - with errors', async() => {
    PsiUrlFetcher.mockImplementation(() => {
      return {
        fetch: (url, { strategy='MOBILE' } = {} ) => {
          if (url === 'https://example.org/item1' && strategy === 'MOBILE') {
            throw new Error('Test Error');
          }
          return { a: "1" };
        }
      }
    });

    const processor = new PsiProcessor(new PsiUrlFetcher());

    const items = [
      { id: 1, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 2, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'MOBILE', errormessage: null, report: null },
      { id: 3, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 4, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'MOBILE', errormessage: null, report: null },
    ]

    const expected = {
      successes: [
        { item: items[0], report: { a: "1" }},        
        { item: items[2], report: { a: "1" }},
        { item: items[3], report: { a: "1" }},
      ],
      failures: [
        { item: items[1], error: new Error('Test Error')},
      ]
    };

    const actual = await processor.processGroup(items);
    expect(actual).toEqual(expected);
  });

  test('Fetches Urls but Blocks', async() => {
    PsiUrlFetcher.mockImplementation(() => {
      return {
        fetch: (url, ) => {
          return { a: "1" };
        }
      }
    });

    const processor = new PsiProcessor(new PsiUrlFetcher(), {
      interval: 200,
      intervalCap: 2
    });

    const items = [
      { id: 1, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 2, status: 'QUEUED', url: 'https://example.org/item1', strategy: 'MOBILE', errormessage: null, report: null },
      { id: 3, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 4, status: 'QUEUED', url: 'https://example.org/item2', strategy: 'MOBILE', errormessage: null, report: null },
      { id: 5, status: 'QUEUED', url: 'https://example.org/item3', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 6, status: 'QUEUED', url: 'https://example.org/item3', strategy: 'MOBILE', errormessage: null, report: null },
      { id: 7, status: 'QUEUED', url: 'https://example.org/item4', strategy: 'DESKTOP', errormessage: null, report: null },
      { id: 8, status: 'QUEUED', url: 'https://example.org/item4', strategy: 'MOBILE', errormessage: null, report: null },
    ]

    const expected = {
      successes: [
        { item: items[0], report: { a: "1" }},
        { item: items[1], report: { a: "1" }},
        { item: items[2], report: { a: "1" }},
        { item: items[3], report: { a: "1" }},
        { item: items[4], report: { a: "1" }},
        { item: items[5], report: { a: "1" }},
        { item: items[6], report: { a: "1" }},
        { item: items[7], report: { a: "1" }},      
      ],
      failures: [],
    };

    const start = new Date().getTime();
    const actual = await processor.processGroup(items);
    const end = new Date().getTime();
    
    expect(actual).toEqual(expected);
    // NOTE: Remember that there is no wait before the first group
    expect(end - start).toBeGreaterThan(600);
  });

});