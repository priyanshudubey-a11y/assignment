'use strict';
const { inTransaction } = require('./db');
const { hashPassword } = require('./passwords');

// Deterministic seed (BE-03, Q-P4). Wipes all data and rebuilds the known state, so running it twice never duplicates.
// Org keys and quote placeholder names follow docs/test-cases.md naming (ORG-51, Q-MULTI, ...).
const BASE = Date.parse('2026-01-05T09:00:00.000Z');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString();

const ORGS = [
  { key: 'ORG-0', name: 'Zero Quotes Ltd', quotes: 0, user: 'U-0', email: 'user0@org0.example.test' },
  { key: 'ORG-1', name: 'One Quote Ltd', quotes: 1, user: 'U-1', email: 'user1@org1.example.test' },
  { key: 'ORG-50', name: 'Fifty Quotes Ltd', quotes: 50, user: 'U-50', email: 'user50@org50.example.test' },
  { key: 'ORG-51', name: 'Fifty-One Quotes Ltd', quotes: 51, user: 'U-51', email: 'user51@org51.example.test' },
  { key: 'ORG-B', name: 'Other Org B Ltd', quotes: 8, user: 'U-B', email: 'userb@orgb.example.test' },
];

const ITEMS = [
  ['Site survey', 1, 25000],
  ['Installation labour (per day)', 3, 48000],
  ['Display panel 55"', 4, 129900],
  ['Mounting kit', 4, 8450],
  ['Annual support plan', 1, 60000],
];

function lineItemsFor(n) {
  const count = 1 + (n % 4); // 1..4 items
  return Array.from({ length: count }, (_, k) => {
    const [d, q, p] = ITEMS[(n + k) % ITEMS.length];
    return { description: d, qty: q, unit: p };
  });
}

function seedDatabase(db, { hashes, password }) {
  const fixtures = { orgs: {}, users: {}, quotes: {}, quoteIdsByOrg: {} };
  const slug = (k) => k.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const createdAt = iso(BASE - DAY);

  return inTransaction(db, () => {
    for (const t of ['sessions', 'quote_line_items', 'quote_versions', 'quotes', 'users', 'organisations']) db.exec(`DELETE FROM ${t}`);

    const insOrg = db.prepare('INSERT INTO organisations (id, name, created_at) VALUES (?, ?, ?)');
    const insUser = db.prepare('INSERT INTO users (id, organisation_id, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
    const insQuote = db.prepare(
      'INSERT INTO quotes (id, organisation_id, reference, title, status, current_version, issued_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insVer = db.prepare(
      'INSERT INTO quote_versions (id, quote_id, version_no, currency, total, valid_until, issued_at, superseded_at, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insItem = db.prepare(
      'INSERT INTO quote_line_items (id, quote_version_id, position, description, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    // addQuote: versions = [{issuedAt, items:[{description,qty,unit}]}...]; the last one is current.
    function addQuote(orgId, orgKey, ref, title, status, versions, quoteIssuedAt) {
      const id = `qt_${slug(ref)}`;
      insQuote.run(id, orgId, ref, title, status, versions.length, quoteIssuedAt, createdAt);
      versions.forEach((v, idx) => {
        const verId = `ver_${slug(ref)}_${idx + 1}`;
        const isCurrent = idx === versions.length - 1;
        const total = v.items.reduce((s, i) => s + i.qty * i.unit, 0);
        const validUntil = iso(Date.parse(v.issuedAt) + 30 * DAY).slice(0, 10);
        insVer.run(verId, id, idx + 1, 'USD', total, validUntil, v.issuedAt, isCurrent ? null : versions[idx + 1].issuedAt, isCurrent ? 1 : 0);
        v.items.forEach((i, pos) => insItem.run(`li_${slug(ref)}_${idx + 1}_${pos}`, verId, pos, i.description, i.qty, i.unit, i.qty * i.unit));
      });
      (fixtures.quoteIdsByOrg[orgKey] ||= []).push(id);
      return { id, reference: ref };
    }

    for (const o of ORGS) {
      const orgId = `org_${slug(o.key)}`;
      insOrg.run(orgId, o.name, createdAt);
      insUser.run(`usr_${slug(o.user)}`, orgId, o.email, hashes[o.user], 'customer');
      fixtures.orgs[o.key] = { id: orgId, name: o.name };
      fixtures.users[o.user] = { email: o.email, password, orgKey: o.key };
      fixtures.quoteIdsByOrg[o.key] = [];

      // ORG-51 carries the special quotes; they count towards its 51.
      const specials = o.key === 'ORG-51' ? 8 : o.key === 'ORG-B' ? 1 : 0;
      let seq = 0;
      const regular = o.quotes - specials;
      for (let n = 0; n < regular; n++) {
        seq += 1;
        const ref = `${o.key}-Q${String(seq).padStart(3, '0')}`;
        // Distinct timestamps, one hour apart.
        const issuedAt = iso(BASE + (o.key === 'ORG-B' ? 7 : 0) * DAY + n * HOUR * 6);
        addQuote(orgId, o.key, ref, `Quote ${seq} for ${o.name}`, 'issued', [{ issuedAt, items: lineItemsFor(n) }], issuedAt);
      }

      if (o.key === 'ORG-B') {
        const issuedAt = iso(BASE + 40 * DAY);
        fixtures.quotes['Q-B1'] = addQuote(orgId, o.key, 'ORG-B-Q-B1', 'Org B private quote', 'issued', [{ issuedAt, items: lineItemsFor(2) }], issuedAt);
      }

      if (o.key === 'ORG-51') {
        const t1 = iso(BASE + 60 * DAY);
        const t2 = iso(BASE + 61 * DAY);
        const t3 = iso(BASE + 62 * DAY);
        fixtures.quotes['Q-MULTI'] = addQuote(orgId, o.key, 'ORG-51-MULTI', 'Quote with three versions', 'issued', [
          { issuedAt: t1, items: lineItemsFor(1) },
          { issuedAt: t2, items: lineItemsFor(2) },
          { issuedAt: t3, items: lineItemsFor(3) },
        ], t1);
        const tr = iso(BASE + 63 * DAY);
        fixtures.quotes['Q-REV'] = addQuote(orgId, o.key, 'ORG-51-REV', 'Quote with one version (for revising)', 'issued', [{ issuedAt: tr, items: lineItemsFor(0) }], tr);
        const tn = iso(BASE + 64 * DAY);
        fixtures.quotes['Q-NOLINES'] = addQuote(orgId, o.key, 'ORG-51-NOLINES', 'Quote without line items', 'issued', [{ issuedAt: tn, items: [] }], tn);
        // Q-TIES: five quotes with an identical sort timestamp.
        const tie = iso(BASE + 70 * DAY);
        const ties = [];
        for (let k = 1; k <= 5; k++) {
          const q = addQuote(orgId, o.key, `ORG-51-TIE${k}`, `Tied timestamp quote ${k}`, 'issued', [{ issuedAt: tie, items: lineItemsFor(k) }], tie);
          fixtures.quotes[`Q-TIES-${k}`] = q;
          ties.push(q);
        }
        fixtures.quotes['Q-TIES'] = { id: ties[0].id, reference: ties[0].reference, ids: ties.map((t) => t.id) };
      }
    }
    return fixtures;
  });
}

async function seed(db, password) {
  // One salted hash per user, computed before the transaction (scrypt is async).
  const hashes = {};
  for (const o of ORGS) hashes[o.user] = await hashPassword(password);
  return seedDatabase(db, { hashes, password });
}

module.exports = { seedDatabase, seed, ORGS };
