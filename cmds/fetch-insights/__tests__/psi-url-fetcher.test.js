const nock = require('nock');
const PsiUrlFetcher = require('../psi-url-fetcher');

describe('PsiUrlFetcher', () => {

  let spy = {};

  beforeAll(() => {
    nock.disableNetConnect();
    spy.consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterAll(() => {
		nock.cleanAll();
    nock.enableNetConnect();
    spy.consoleError.mockRestore();
  });
  

  test('Fetches a desktop URL with default params', async () => {
    const scope = nock('https://www.googleapis.com')
      .get('/pagespeedonline/v5/runPagespeed/')
      .query({
        url: 'https://example.org/test-url',
        key: '11111',
        category: [ 'ACCESSIBILITY', 'BEST_PRACTICES', 'PERFORMANCE', 'PWA', 'SEO' ],
        strategy: 'DESKTOP',
      })
        .reply(200, {});

    const expected = {};

    const fetcher = new PsiUrlFetcher({
      apikey: '11111'
    });

    const actual = await fetcher.fetch('https://example.org/test-url');

    expect(actual).toEqual(expected);
    scope.done();
  });

  test('Fetches a desktop URL with mobile strategy', async () => {
    const scope = nock('https://www.googleapis.com')
      .get('/pagespeedonline/v5/runPagespeed/')
      .query({
        url: 'https://example.org/test-url',
        key: '11111',
        category: [ 'ACCESSIBILITY', 'BEST_PRACTICES', 'PERFORMANCE', 'PWA', 'SEO' ],
        strategy: 'MOBILE',
      })
        .reply(200, {});

    const expected = {};

    const fetcher = new PsiUrlFetcher({
      apikey: '11111'
    });

    const actual = await fetcher.fetch('https://example.org/test-url', { strategy: 'MOBILE' });

    expect(actual).toEqual(expected);
    scope.done();
  });

  test('Fetches a desktop URL with single strategy', async () => {
    const scope = nock('https://www.googleapis.com')
      .get('/pagespeedonline/v5/runPagespeed/')
      .query({
        url: 'https://example.org/test-url',
        key: '11111',
        category: 'ACCESSIBILITY',
        strategy: 'DESKTOP',
      })
        .reply(200, {});

    const expected = {};

    const fetcher = new PsiUrlFetcher({
      apikey: '11111'
    });

    const actual = await fetcher.fetch('https://example.org/test-url', { category: 'ACCESSIBILITY' });

    expect(actual).toEqual(expected);
    scope.done();
  });

})