'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { migrate } = require('./migrations');

function openDatabase(dbPath, { runMigrations = true } = {}) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 15000');
  db.exec('PRAGMA foreign_keys = ON');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  if (runMigrations) migrate(db);
  return db;
}

// BEGIN IMMEDIATE takes the write lock up front so concurrent writers queue instead of deadlocking.
function inTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* connection may already be gone */ }
    throw err;
  }
}

module.exports = { openDatabase, inTransaction };
