// In-memory data for the contract mock (FE-01). Shapes follow plans/openapi.yaml.
// Mock-only accounts (NOT the real seed accounts, which come from app/backend/seed/fixtures.json):
//   acme@example.test   / Passw0rd!  -> org "Acme (mock)", 51 quotes, Q-MULTI has 2 versions
//   empty@example.test  / Passw0rd!  -> org with 0 quotes
//   other@example.test  / Passw0rd!  -> org B, 1 quote (invisible to the others, 404 for them)

export const PASSWORD = 'Passw0rd!';

const iso = (d) => new Date(d).toISOString();

function makeVersion(quoteId, versionNo, issuedAt, items, supersededAt = null, currency = 'USD') {
  const lineItems = items.map(([description, qty, unitPrice], i) => ({
    id: `${quoteId}-v${versionNo}-li${i + 1}`,
    description,
    qty,
    unitPrice,
    lineTotal: qty * unitPrice,
  }));
  return {
    versionNo,
    isCurrent: supersededAt === null,
    issuedAt: iso(issuedAt),
    supersededAt: supersededAt ? iso(supersededAt) : null,
    currency,
    total: lineItems.reduce((s, l) => s + l.lineTotal, 0),
    validUntil: '2026-12-31',
    lineItems,
  };
}

export function createStore() {
  const orgs = {
    A: { id: 'org-a', name: 'Acme (mock)' },
    E: { id: 'org-e', name: 'Empty Co (mock)' },
    B: { id: 'org-b', name: 'Other Org (mock)' },
  };
  const users = [
    { id: 'u-acme', email: 'acme@example.test', role: 'customer', org: orgs.A },
    { id: 'u-empty', email: 'empty@example.test', role: 'customer', org: orgs.E },
    { id: 'u-other', email: 'other@example.test', role: 'customer', org: orgs.B },
  ];
  const quotes = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 1; i <= 51; i++) {
    const id = i === 1 ? 'q-multi' : i === 2 ? 'q-noitems' : `q-${String(i).padStart(3, '0')}`;
    const issuedAt = base + i * 86400000;
    const items = i === 2 ? [] : [['Consulting day', i, 10000 + i], ['Travel', 1, 2550]];
    const versions =
      i === 1
        ? [makeVersion(id, 1, issuedAt, items, issuedAt + 5 * 86400000), makeVersion(id, 2, issuedAt + 5 * 86400000, [['Consulting day', 3, 12000]])]
        : [makeVersion(id, 1, issuedAt, items)];
    quotes.push({
      id,
      orgId: orgs.A.id,
      reference: `QT-${String(1000 + i)}`,
      title: i === 1 ? 'Website rebuild' : i === 2 ? 'Empty quote' : `Quote number ${i}`,
      status: i % 3 === 0 ? 'Accepted' : 'Sent',
      versions,
    });
  }
  quotes.push({
    id: 'q-other-org',
    orgId: orgs.B.id,
    reference: 'QT-9001',
    title: 'Other organisation quote',
    status: 'Sent',
    versions: [makeVersion('q-other-org', 1, base, [['Secret item', 1, 99900]])],
  });
  return { orgs, users, quotes, sessions: new Map(), failNext: 0 };
}

export function reviseQuote(store, quoteId) {
  const q = store.quotes.find((x) => x.id === quoteId);
  if (!q) return null;
  const cur = q.versions[q.versions.length - 1];
  const now = Date.now();
  cur.isCurrent = false;
  cur.supersededAt = iso(now);
  const next = makeVersion(q.id, cur.versionNo + 1, now, [['Revised item', cur.versionNo + 1, 10000]]);
  q.versions.push(next);
  return next.versionNo;
}

export const summary = (q) => {
  const cur = q.versions[q.versions.length - 1];
  const first = q.versions[0];
  return {
    id: q.id,
    reference: q.reference,
    title: q.title,
    status: q.status,
    currentVersionNo: cur.versionNo,
    currency: cur.currency,
    total: cur.total,
    issuedAt: first.issuedAt,
  };
};
export const versionSummary = (v) => ({
  versionNo: v.versionNo,
  isCurrent: v.isCurrent,
  issuedAt: v.issuedAt,
  supersededAt: v.supersededAt,
  currency: v.currency,
  total: v.total,
});
