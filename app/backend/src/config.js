'use strict';
const path = require('node:path');

// All configuration comes from environment variables (BE-01).
function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3001),
    dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'quote-portal.db'),
    // Express "trust proxy" value so req.secure is true behind an HTTPS terminator.
    trustProxy: env.TRUST_PROXY === undefined ? false : env.TRUST_PROXY === 'true' ? true : env.TRUST_PROXY,
    // 'auto' = Secure when the request is HTTPS; 'true'/'false' force it.
    cookieSecure: env.COOKIE_SECURE || 'auto',
    logLevel: env.LOG_LEVEL || 'info', // 'silent' disables request logs
    fixturesPath: env.SEED_FIXTURES_PATH || path.join(__dirname, '..', 'seed', 'fixtures.json'),
    seedPassword: env.SEED_PASSWORD || 'Test-Passw0rd!',
  };
}

module.exports = { loadConfig };
