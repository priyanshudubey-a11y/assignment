'use strict';
const { loadConfig } = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = createApp({ db, config });

const server = app.listen(config.port, () => {
  console.log(`Quote Portal API listening on http://localhost:${config.port} (db: ${config.dbPath})`);
});

function shutdown() {
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
