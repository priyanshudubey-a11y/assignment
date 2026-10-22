'use strict';
const crypto = require('node:crypto');

// Users and server-side sessions (BE-05). Not org-scoped by nature: the org is derived from the user row.
const hashId = (id) => crypto.createHash('sha256').update(id).digest('hex');

class UserStore {
  constructor(db) {
    this.db = db;
  }

  findByEmail(email) {
    return (
      this.db
        .prepare(
          `SELECT u.id, u.email, u.role, u.password_hash, u.organisation_id, o.name AS organisation_name
             FROM users u JOIN organisations o ON o.id = u.organisation_id
            WHERE lower(u.email) = lower(?)`
        )
        .get(email) || null
    );
  }

  createSession(userId) {
    const sessionId = crypto.randomBytes(32).toString('base64url');
    this.db
      .prepare('INSERT INTO sessions (id_hash, user_id, created_at) VALUES (?, ?, ?)')
      .run(hashId(sessionId), userId, new Date().toISOString());
    return sessionId;
  }

  findUserBySession(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 256) return null;
    return (
      this.db
        .prepare(
          `SELECT u.id, u.email, u.role, u.organisation_id, o.name AS organisation_name
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             JOIN organisations o ON o.id = u.organisation_id
            WHERE s.id_hash = ?`
        )
        .get(hashId(sessionId)) || null
    );
  }

  destroySession(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId) return;
    this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashId(sessionId));
  }

  // Server-side invalidation of every session of a user (e.g. admin action); replayed cookies stop working.
  destroyUserSessions(userId) {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

function toApiUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    organisation: { id: row.organisation_id, name: row.organisation_name },
  };
}

module.exports = { UserStore, toApiUser };
