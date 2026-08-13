import pool from "../lib/mysql.js";

class ExternalIdentityRepository {
  async findBySubject(tenantId, provider, providerSubject, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, UserId, Provider, ProviderSubject, ExternalEmail, CreatedAt, UpdatedAt
       FROM external_identities
       WHERE TenantId = ? AND Provider = ? AND ProviderSubject = ?`,
      [tenantId, provider, providerSubject]
    );
    return rows[0] || null;
  }

  async findByUserId(userId, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, TenantId, UserId, Provider, ProviderSubject, ExternalEmail, CreatedAt, UpdatedAt
       FROM external_identities
       WHERE UserId = ?`,
      [userId]
    );
    return rows;
  }

  async insert({ tenantId, userId, provider, providerSubject, externalEmail }, db = pool) {
    const [result] = await db.query(
      `INSERT INTO external_identities (TenantId, UserId, Provider, ProviderSubject, ExternalEmail)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, userId, provider, providerSubject, externalEmail || null]
    );
    return result.insertId;
  }
}

export const externalIdentityRepository = new ExternalIdentityRepository();
export default externalIdentityRepository;
