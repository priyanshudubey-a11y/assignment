'use strict';
const crypto = require('node:crypto');
const { inTransaction } = require('./db');

// Issues version n+1 of a quote: copies the line items with a 10% unit price increase, marks the previous
// current version superseded and moves the quote's current_version, all in one transaction (BE-04).
// The quote's own issued_at (version 1 date) is not touched, so the list order does not change (Q-P3).
function reviseQuote(db, quoteId, now = new Date()) {
  return inTransaction(db, () => {
    const quote = db.prepare('SELECT id, current_version FROM quotes WHERE id = ?').get(quoteId);
    if (!quote) return null;
    const prev = db.prepare('SELECT * FROM quote_versions WHERE quote_id = ? AND is_current = 1').get(quoteId);
    const nextNo = db.prepare('SELECT MAX(version_no) AS m FROM quote_versions WHERE quote_id = ?').get(quoteId).m + 1;
    const ts = now.toISOString();
    const items = db.prepare('SELECT * FROM quote_line_items WHERE quote_version_id = ? ORDER BY position').all(prev.id);

    db.prepare('UPDATE quote_versions SET is_current = 0, superseded_at = ? WHERE id = ?').run(ts, prev.id);
    const versionId = 'ver_' + crypto.randomUUID();
    const revised = items.map((i, idx) => {
      const unit = Math.round(i.unit_price * 1.1);
      return { id: 'li_' + crypto.randomUUID(), position: idx, description: i.description, qty: i.qty, unit, line: i.qty * unit };
    });
    const total = revised.reduce((s, i) => s + i.line, 0);
    const validUntil = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    db.prepare(
      'INSERT INTO quote_versions (id, quote_id, version_no, currency, total, valid_until, issued_at, superseded_at, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)'
    ).run(versionId, quoteId, nextNo, prev.currency, total, validUntil, ts);
    const ins = db.prepare(
      'INSERT INTO quote_line_items (id, quote_version_id, position, description, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const i of revised) ins.run(i.id, versionId, i.position, i.description, i.qty, i.unit, i.line);
    db.prepare('UPDATE quotes SET current_version = ? WHERE id = ?').run(nextNo, quoteId);
    return { quoteId, previousVersionNo: prev.version_no, versionNo: nextNo, total };
  });
}

module.exports = { reviseQuote };
