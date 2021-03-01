const Database = require('better-sqlite3');

// Schema creation SQL.
const PSI_QUEUE_SCHEMA = `CREATE TABLE IF NOT EXISTS PsiQueue (
  id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  url text NOT NULL,
  strategy text NOT NULL,
  status text NOT NULL,
  errormessage text,
  report text
);
`;

const IGNORE_URLS_SCHEMA = `CREATE TABLE IF NOT EXISTS IgnoreUrls (
  id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  url text NOT NULL,
  status int NOT NULL,
  contenttype text NOT NULL
)`;

/**
 * This class wraps a persistant queue storage.
 *
 * For now the idea is Sqlite, but it could be file system
 * or something else. Heck it could be some cloud based storage.
 * The idea is that we should be able to enqueue items, and set
 * a state for those items. So we can add all urls, then start
 * fetching in batches.  
 */
class QueueStorage {

  /**
   * Creates a new instance of the QueueStorage
   * @param {string} databaseFileName - The full path to the database file.
   */
  constructor(databaseFileName) {
    try {
      // Create the DB.
      this.storage = new Database(databaseFileName);

      // Create the queue table.
      this.storage.exec(PSI_QUEUE_SCHEMA);

      // Create the ignored URLs table.
      this.storage.exec(IGNORE_URLS_SCHEMA);

    } catch (err) {
      console.error(`Could not create database at ${databaseFileName}`);
      throw err;
    }

  }

  /**
   * Adds an item to the ignored URLs list
   *
   * @param {Array<Object>} items the items to add. 
   */
  addIgnoreUrls(items) {
    try {
      const insertCmd = this.storage.prepare('INSERT INTO IgnoreUrls (url, status, contenttype) VALUES (@url, @status, @contenttype)');
      const insertItemsCmd = this.storage.transaction((items) => {
        for (const item of items) insertCmd.run(item);
      });
      insertItemsCmd(items);
    } catch (err) {
      console.error(`Could not add ignored URLs`);
      throw err;
    }
  }

  /**
   * Gets all of the ignored URLs
   */
  getIgnoreUrls({
    limit=1000000
  } = {}) {
    // Setup the fetch all queries
    const querySql = `SELECT
        id,
        url,
        status,
        contenttype
      FROM IgnoreUrls
      LIMIT @limit
    `;

    const query = this.storage.prepare(querySql);

    try {
      return query.all({ limit });
    } catch (err) {
      console.error(`Could not fetch all ignore urls`);
      throw err;
    }
  }

  /**
   * Enqueues an array of items. These should be new.
   *
   * @param {Array<Object>} items the PSI items to enqueue.
   */
  enqueueItems(items) {
    // Add on our new status.
    const itemsToEnqueue = items.map(item => ({
      ...item,
      status: 'QUEUED'
    }));

    try {
      // Setup the insert statement. 
      const insertCmd = this.storage.prepare('INSERT INTO PsiQueue (url, strategy, status) VALUES (@url, @strategy, @status)');
      const insertItemsCmd = this.storage.transaction((items) => {
        for (const item of items) insertCmd.run(item);
      });
      insertItemsCmd(itemsToEnqueue);
    } catch (err) {
      console.error(`Could not enqueue items`);
      throw err;
    }
  }

  /**
   * Gets all the queued items by a status.
   *
   * @param {Object} options the options for the query
   * @param {string} options.status the status, an empty string will get all. (Defualt: '')
   * @param {number} options.limit the number of items to fetch. (Default: 1000000)
   */
  getQueueItems({
    status='',
    includeReports = false,
    limit=1000000
  } = {}) {
    // NOTE: 1000000 is the Sqlite3 default limit.

    // Setup the fetch all queries
    const querySql = `SELECT
        id,
        url,
        strategy,
        status,
        errormessage
        ${includeReports ? ', report' : ''}
      FROM PsiQueue
      ${(status && status !== '') ? 'WHERE status=@status' : ''}
      LIMIT @limit
    `;

    const statusQuery = this.storage.prepare(querySql);

    try {

      return statusQuery.all({
            status,
            limit
        }).map(item => ({
          ...item,
          report: item.report ? JSON.parse(item.report) : null
        })
      );

    } catch (err) {
      console.error(`Could not fetch all queue items by status for ${status ? status : 'all'}`);
      throw err;
    }
  }

  /**
   * Updates and items status. errormessage and/or report.
   *
   * If a errormessage or report is not provided/null than a
   * NULL value will be inserted into the DB.
   *
   * @param {number} id the id of the item 
   * @param {string} status the status of this record 
   * @param {string} errormessage an optional error message
   * @param {string} report the PSI report (big ol JSON string) 
   */
  updateStatus(
    id,
    status,
    errormessage,
    report
  ) {
    if (!id) {
      throw Error(`Id is required to update.`);
    }

    if (!status) {
      throw new Error(`Status is required to update.`)
    }

    try {
      const updateSql = `UPDATE PsiQueue SET
        status=@status,
        errormessage=${errormessage ? '@errormessage' : 'NULL'},
        report=${report ? '@report' : 'NULL'}
        WHERE id=@id
      `;

      const dbStatement = this.storage.prepare(updateSql);

      const info = dbStatement.run({
        id,
        status,
        errormessage,
        report: report ? JSON.stringify(report) : null
      });

    } catch(err) {
      console.log(`Could not update item, ${id}, with status ${status}`);
      throw err;
    }
  }

  /**
   * Closes database.
   *
   * Make sure this is called before the program exits.
   */
  close() {
    this.storage.close();
  }

}

module.exports = QueueStorage;