const QueueStorage = require('../queue-storage');

describe('QueueStorage', () => {

  test('Enqueues items and get all', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'}
    ]);

    const expected = [
      {id: 1, url: 'https://example.org/page-1', strategy: 'DESKTOP', status: 'QUEUED', errormessage: null, report: null },
      {id: 2, url: 'https://example.org/page-1', strategy: 'MOBILE',  status: 'QUEUED', errormessage: null, report: null }
    ]
    const actual = storage.getQueueItems();
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('Enqueues nothing and get all does not break', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    const expected = [];

    const actual = storage.getQueueItems();
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('getQueueItems - option - status', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'},
      {url: 'https://example.org/page-2', strategy: 'MOBILE'},
      {url: 'https://example.org/page-4', strategy: 'MOBILE'}
    ]);

    // Make one item a different status
    storage.updateStatus(1, 'FETCHING');

    const expected = [
      {id: 1, url: 'https://example.org/page-1', strategy: 'DESKTOP', status: 'FETCHING', errormessage: null, report: null },
    ]
    const actual = storage.getQueueItems({status: 'FETCHING'});
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('getQueueItems - option - limit', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'},
      {url: 'https://example.org/page-2', strategy: 'MOBILE'},
      {url: 'https://example.org/page-4', strategy: 'MOBILE'}
    ]);

    const expected = [
      {id: 1, url: 'https://example.org/page-1', strategy: 'DESKTOP', status: 'QUEUED', errormessage: null, report: null },
      {id: 2, url: 'https://example.org/page-1', strategy: 'MOBILE',  status: 'QUEUED', errormessage: null, report: null }
    ]
    const actual = storage.getQueueItems({limit: 2});
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('getQueueItems - option - include reports', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'},
      {url: 'https://example.org/page-2', strategy: 'MOBILE'},
      {url: 'https://example.org/page-4', strategy: 'MOBILE'}
    ]);

    storage.updateStatus(2, 'FETCHED', null, { a: 1 });

    const expected = [
      {id: 1, url: 'https://example.org/page-1', strategy: 'DESKTOP', status: 'QUEUED', errormessage: null, report: null },
      {id: 2, url: 'https://example.org/page-1', strategy: 'MOBILE',  status: 'FETCHED', errormessage: null, report: { a: 1 } },
      {id: 3, url: 'https://example.org/page-2', strategy: 'MOBILE', status: 'QUEUED', errormessage: null, report: null },
      {id: 4, url: 'https://example.org/page-4', strategy: 'MOBILE', status: 'QUEUED', errormessage: null, report: null },
    ]
    const actual = storage.getQueueItems({includeReports: true});
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('getQueueItems - option - all', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'},
      {url: 'https://example.org/page-2', strategy: 'MOBILE'},
      {url: 'https://example.org/page-4', strategy: 'MOBILE'}
    ]);

    // Make one item a different status
    storage.updateStatus(2, 'FETCHED', null, { a: 1 });
    storage.updateStatus(3, 'FETCHED', null, { a: 1 });
    storage.updateStatus(4, 'FETCHED', null, { a: 1 });

    const expected = [
      {id: 2, url: 'https://example.org/page-1', strategy: 'MOBILE',  status: 'FETCHED', errormessage: null, report: { a: 1 } },
      {id: 3, url: 'https://example.org/page-2', strategy: 'MOBILE',  status: 'FETCHED', errormessage: null, report: { a: 1 } }
    ];
    const actual = storage.getQueueItems({status: 'FETCHED', limit: 2, includeReports: true});
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('UpdateStatus works', () => {
    // :memmory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    storage.enqueueItems([
      {url: 'https://example.org/page-1', strategy: 'DESKTOP'},
      {url: 'https://example.org/page-1', strategy: 'MOBILE'}
    ]);

    const expected = [
      {id: 1, url: 'https://example.org/page-1', strategy: 'DESKTOP', status: 'ERROR_REQUEUED', errormessage: 'There Was an Error', report: null },
      {id: 2, url: 'https://example.org/page-1', strategy: 'MOBILE',  status: 'FETCHED', errormessage: null, report: { a: 1 } }
    ]

    storage.updateStatus(1, 'ERROR_REQUEUED', 'There Was an Error', null);
    storage.updateStatus(2, 'FETCHED', null, { a: 1 });

    const actual = storage.getQueueItems({ includeReports: true });
    storage.close();

    expect(actual).toEqual(expected);
  });

  test('Add ignore urls and get them again', () => {
    // :memory: should create an sqlite DB in memory.
    const storage = new QueueStorage(':memory:');

    const ignoreUrls = [
      { url: 'https://example.org/page-1', status: 404, contenttype: 'UNKNOWN' },
      { url: 'https://example.org/file-1', status: 200, contenttype: 'application/pdf' },
      { url: 'https://example.org/page-2', status: 500, contenttype: 'UNKNOWN' },
    ];

    storage.addIgnoreUrls(ignoreUrls);

    // Test without limit
    const actualNoLimit = storage.getIgnoreUrls();
    expect(actualNoLimit).toEqual([
      { id: 1, ...ignoreUrls[0] },
      { id: 2, ...ignoreUrls[1] },
      { id: 3, ...ignoreUrls[2] },
    ])

    // Test without limit
    const actualWLimit = storage.getIgnoreUrls({ limit: 2 });
    expect(actualWLimit).toEqual([
      { id: 1, ...ignoreUrls[0] },
      { id: 2, ...ignoreUrls[1] },
    ])

  });

});