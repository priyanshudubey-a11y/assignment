'use strict';
const { loadConfig } = require('../src/config');
const { openDatabase } = require('../src/db');
const { reviseQuote } = require('../src/revise');

const quoteId = process.argv[2];
if (!quoteId) {
  console.error('Usage: npm run seed:revise -- <quoteId>');
  process.exit(2);
}
const config = loadConfig();
let db;
try {
  db = openDatabase(config.dbPath);
  const result = reviseQuote(db, quoteId);
  if (!result) {
    console.error(`Quote not found: ${quoteId}. Nothing was changed.`);
    process.exit(1);
  }
  console.log(`Quote ${result.quoteId}: version ${result.previousVersionNo} superseded, version ${result.versionNo} is now current (total ${result.total}).`);
} catch (err) {
  console.error('seed:revise failed:', err.message);
  process.exit(1);
} finally {
  if (db) db.close();
}
