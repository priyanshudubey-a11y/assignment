'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const request = require('supertest');
const SwaggerParser = require('@apidevtools/swagger-parser');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');
const { seed } = require('../src/seed');

const OPENAPI_PATH = process.env.OPENAPI_PATH || path.join(__dirname, '..', '..', '..', 'plans', 'openapi.yaml');
const PASSWORD = 'Test-Passw0rd!';

async function makeEnv() {
  const db = openDatabase(':memory:');
  const fixtures = await seed(db, PASSWORD);
  const logs = [];
  const app = createApp({ db, config: { logLevel: 'silent' }, logger: (l) => logs.push(l) });
  return { db, fixtures, app, logs };
}

async function loginAgent(app, email, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.body)}`);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  return { cookie, res, get: (url) => request(app).get(url).set('Cookie', cookie) };
}

let specPromise;
function loadSpec() {
  specPromise ||= SwaggerParser.dereference(OPENAPI_PATH);
  return specPromise;
}

// Checks that a response matches what plans/openapi.yaml declares for that operation and status (BE-13).
async function assertContract(method, pathTemplate, res) {
  const spec = await loadSpec();
  const op = spec.paths[pathTemplate] && spec.paths[pathTemplate][method];
  assert.ok(op, `operation ${method} ${pathTemplate} is not in the contract`);
  const def = op.responses[String(res.status)];
  assert.ok(def, `status ${res.status} is not declared for ${method} ${pathTemplate}`);
  const media = def.content && def.content['application/json'];
  if (!media) {
    assert.ok(res.text === '' || res.text === undefined, `status ${res.status} should have no body`);
    return;
  }
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(media.schema);
  assert.ok(validate(res.body), `${method} ${pathTemplate} ${res.status} does not match contract: ${JSON.stringify(validate.errors)}`);
}

module.exports = { makeEnv, loginAgent, assertContract, loadSpec, PASSWORD, OPENAPI_PATH };
