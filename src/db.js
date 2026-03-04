const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/vsc.db');

let db = null;

async function ensureDb() {
  if (db) return db;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

const dbProxy = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'getDb') return ensureDb;
    if (prop === 'saveDb') return () => { }; // No-op now

    if (!db) {
      throw new Error('Database not initialized. Call getDb() first (async), or await the promise.');
    }

    if (typeof db[prop] === 'function') {
      return db[prop].bind(db);
    }
    return db[prop];
  }
});

module.exports = dbProxy;
module.exports.getDb = ensureDb;
module.exports.saveDb = () => { };
