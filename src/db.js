const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/vsc.db');

let db = null;
let dbWrapper = null;
let initPromise = null;

async function ensureDb() {
  if (db) return dbWrapper;
  
  if (!initPromise) {
    initPromise = (async () => {
      const SQL = await initSqlJs();
      const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
      db = new SQL.Database(fileBuffer);
      dbWrapper = createDbWrapper();
      return dbWrapper;
    })();
  }
  
  return initPromise;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

function createPreparedStatement(sql) {
  return {
    all: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      let result = null;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    },
    run: (...params) => {
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (params.length > 0) {
        db.run(sql, params);
      } else {
        db.run(sql);
      }
      if (!isSelect) {
        const result = db.exec("SELECT last_insert_rowid() as id");
        const lastId = result[0]?.values[0]?.[0] || 0;
        saveDb();
        return { lastInsertRowid: lastId };
      }
      saveDb();
      return { lastInsertRowid: 0 };
    }
  };
}

function createDbWrapper() {
  return {
    prepare: (sql) => createPreparedStatement(sql),
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      if (params) {
        db.run(sql, params);
      } else {
        db.run(sql);
      }
      saveDb();
    },
    saveDb
  };
}

const dbProxy = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'getDb') return ensureDb;
    if (prop === 'saveDb') return saveDb;
    
    if (!db) {
      throw new Error('Database not initialized. Call getDb() first (async), or await the promise.');
    }
    return dbWrapper[prop];
  }
});

module.exports = dbProxy;
module.exports.getDb = ensureDb;
module.exports.saveDb = saveDb;
