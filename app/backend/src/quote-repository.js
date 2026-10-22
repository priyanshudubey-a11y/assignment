'use strict';

// All quote SQL lives here (Q-P1) so Postgres can replace it later.
// Every method takes the organisation id as its first argument and refuses to run without it (BE-02, BE-08).

// reference is unique, so it is already a total order; the id tiebreak is only needed for issued_at.
const SORTS = {
  'issued_at:desc': 'q.issued_at DESC, q.id DESC',
  'issued_at:asc': 'q.issued_at ASC, q.id DESC',
  'reference:asc': 'q.reference ASC',
  'reference:desc': 'q.reference DESC',
};

function requireOrg(organisationId) {
  if (typeof organisationId !== 'string' || organisationId.length === 0) {
    throw new TypeError('organisationId is required');
  }
}

function toSummary(row) {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    currentVersionNo: row.current_version,
    currency: row.currency,
    total: row.total,
    issuedAt: row.issued_at,
  };
}

function toVersionSummary(row) {
  return {
    versionNo: row.version_no,
    isCurrent: row.is_current === 1,
    issuedAt: row.issued_at,
    supersededAt: row.superseded_at ?? null,
    currency: row.currency,
    total: row.total,
  };
}

class QuoteRepository {
  constructor(db) {
    this.db = db;
  }

  static get SORTS() {
    return Object.keys(SORTS);
  }

  listQuotes(organisationId, { page, pageSize, sort }) {
    requireOrg(organisationId);
    const orderBy = SORTS[sort];
    if (!orderBy) throw new RangeError('unsupported sort'); // allow-list: never interpolate caller input
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM quotes WHERE organisation_id = ?').get(organisationId);
    const rows = this.db
      .prepare(
        `SELECT q.id, q.reference, q.title, q.status, q.current_version, q.issued_at, v.currency, v.total
           FROM quotes q
           JOIN quote_versions v ON v.quote_id = q.id AND v.version_no = q.current_version
          WHERE q.organisation_id = ?
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`
      )
      .all(organisationId, pageSize, (page - 1) * pageSize);
    return { items: rows.map(toSummary), total: n };
  }

  getQuoteSummary(organisationId, quoteId) {
    requireOrg(organisationId);
    const row = this.db
      .prepare(
        `SELECT q.id, q.reference, q.title, q.status, q.current_version, q.issued_at, v.currency, v.total
           FROM quotes q
           JOIN quote_versions v ON v.quote_id = q.id AND v.version_no = q.current_version
          WHERE q.organisation_id = ? AND q.id = ?`
      )
      .get(organisationId, quoteId);
    return row ? toSummary(row) : null;
  }

  // Quote with current version (incl. line items) and all versions newest first; null when not visible.
  getQuote(organisationId, quoteId) {
    requireOrg(organisationId);
    const quote = this.getQuoteSummary(organisationId, quoteId);
    if (!quote) return null;
    const versions = this._versionRows(quoteId).map(toVersionSummary);
    const current = this._versionRows(quoteId).find((r) => r.version_no === quote.currentVersionNo);
    return {
      quote,
      currentVersion: this._withLineItems(current),
      currentVersionNo: quote.currentVersionNo,
      versions,
    };
  }

  getVersion(organisationId, quoteId, versionNo) {
    requireOrg(organisationId);
    const quote = this.getQuoteSummary(organisationId, quoteId);
    if (!quote) return null;
    const row = this.db
      .prepare('SELECT * FROM quote_versions WHERE quote_id = ? AND version_no = ?')
      .get(quoteId, versionNo);
    if (!row) return null;
    const version = this._withLineItems(row);
    return {
      version,
      isCurrent: version.isCurrent,
      superseded: !version.isCurrent,
      currentVersionNo: quote.currentVersionNo,
    };
  }

  _versionRows(quoteId) {
    return this.db.prepare('SELECT * FROM quote_versions WHERE quote_id = ? ORDER BY version_no DESC').all(quoteId);
  }

  _withLineItems(row) {
    const items = this.db
      .prepare('SELECT id, description, qty, unit_price, line_total FROM quote_line_items WHERE quote_version_id = ? ORDER BY position')
      .all(row.id);
    return {
      ...toVersionSummary(row),
      validUntil: row.valid_until ?? null,
      lineItems: items.map((i) => ({
        id: i.id,
        description: i.description,
        qty: i.qty,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      })),
    };
  }

  // Cheap connectivity probe used by /api/health.
  ping() {
    this.db.prepare('SELECT 1 AS ok').get();
    return true;
  }
}

module.exports = { QuoteRepository };
