const nock = require('nock');
const PageTypeFetcher = require('../page-type-fetcher');

describe('PageTypeFetcher', () => {

  let spy = {};

  beforeAll(() => {
    nock.disableNetConnect();
    // We want this to get it to shutup so console logging messages in our
    // code do not appear on the console.
    spy.consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    // We need this to check that we are logging an error in some tests.
    spy.consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterAll(() => {
		nock.cleanAll();
    nock.enableNetConnect();
    spy.consoleLog.mockRestore();
    spy.consoleError.mockRestore();
  });
  
  test('fetchInfo works', async () => {
    const scope = nock('https://example.org')
      .head('/test-web-page')
        .reply(200, {}, {
          'content-type': 'text/html; charset=UTF-8',
        })
      .head('/some-file.pdf')
        .reply(200, {}, {
          'content-type': 'application/pdf',
      });

      const expected = [
        {
          url: 'https://example.org/test-web-page',
          status: 200,
          contenttype: 'text/html; charset=UTF-8'
        },
        {
          url: 'https://example.org/some-file.pdf',
          status: 200,
          contenttype: 'application/pdf'
        }
      ];

      const typeFetcher = new PageTypeFetcher();
      const actual = await typeFetcher.fetch([
        'https://example.org/test-web-page',
        'https://example.org/some-file.pdf'
      ]);
      expect(actual).toEqual(expected);
      // TODO: Test fetching notice
      scope.done();
  });

  test('Loads and parses sitemap with 404', async () => {
    const scope = nock('https://example.org')
      .head('/test-web-page')
        .reply(404, {}, {
          'content-type': 'text/html; charset=UTF-8',
        });

    const expected = [
      {
        url: 'https://example.org/test-web-page',
        status: 404,
        contenttype: 'unknown'
      }
    ];

    const typeFetcher = new PageTypeFetcher();
    const actual = await typeFetcher.fetch(['https://example.org/test-web-page']);
    expect(actual).toEqual(expected);
    // TODO: Test fetching notice.
    scope.done();
  });

  test('Loads and parses sitemap with 503', async () => {
    const scope = nock('https://example.org')
      .head('/test-web-page')
        .reply(503, {}, {
          'content-type': 'text/html; charset=UTF-8',
        });

    const expected = [
      {
        url: 'https://example.org/test-web-page',
        status: 503,
        contenttype: 'unknown'
      }
    ];

    const typeFetcher = new PageTypeFetcher();
    const actual = await typeFetcher.fetch(['https://example.org/test-web-page']);
    expect(actual).toEqual(expected);
    expect(spy.consoleError.mock.calls[0][0]).toEqual('ERROR fetching url info https://example.org/test-web-page');
    scope.done();
  });

  // TODO: Concurrency Tests

});