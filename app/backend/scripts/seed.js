'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { openDatabase } = require('../src/db');
const { seed } = require('../src/seed');

(async () => {
  const config = loadConfig();
  const db = openDatabase(config.dbPath);
  const fixtures = await seed(db, config.seedPassword);
  fs.mkdirSync(path.dirname(config.fixturesPath), { recursive: true });
  fs.writeFileSync(config.fixturesPath, JSON.stringify(fixtures, null, 2) + '\n');
  const counts = Object.fromEntries(Object.entries(fixtures.quoteIdsByOrg).map(([k, v]) => [k, v.length]));
  console.log(`Seeded ${config.dbPath}`);
  console.log('Quotes per org:', JSON.stringify(counts));
  console.log(`Fixtures written to ${config.fixturesPath}`);
  db.close();
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
