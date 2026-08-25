import pool from "../lib/mysql.js";

class LabTokenPackageRepository {
  async createPackage({ labId, tokenQuantity, priceAmount, currency = 'INR', isActive = 1, displayOrder = 0, createdBy = null }, db = pool) {
    const lId = String(labId);
    const [result] = await db.query(
      `INSERT INTO lab_token_packages (LabId, TokenQuantity, PriceAmount, Currency, IsActive, DisplayOrder, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE PriceAmount = VALUES(PriceAmount), IsActive = VALUES(IsActive), DisplayOrder = VALUES(DisplayOrder), UpdatedAt = CURRENT_TIMESTAMP`,
      [lId, Number(tokenQuantity) || 0, Number(priceAmount) || 0, currency, isActive ? 1 : 0, Number(displayOrder) || 0, createdBy]
    );
    return result.insertId || (await this.getPackageByLabAndQuantity(lId, tokenQuantity, db))?.Id;
  }

  async getPackageByLabAndQuantity(labId, tokenQuantity, db = pool) {
    const lId = String(labId);
    const [rows] = await db.query(
      `SELECT Id, LabId, TokenQuantity, PriceAmount, Currency, IsActive, DisplayOrder, CreatedBy, CreatedAt, UpdatedAt
       FROM lab_token_packages
       WHERE LabId = ? AND TokenQuantity = ?`,
      [lId, Number(tokenQuantity) || 0]
    );
    return rows[0] || null;
  }

  async getPackageById(id, db = pool) {
    const [rows] = await db.query(
      `SELECT Id, LabId, TokenQuantity, PriceAmount, Currency, IsActive, DisplayOrder, CreatedBy, CreatedAt, UpdatedAt
       FROM lab_token_packages
       WHERE Id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async getActivePackagesForLab(labId, db = pool) {
    const lId = String(labId);
    const [rows] = await db.query(
      `SELECT Id, LabId, TokenQuantity, PriceAmount, Currency, IsActive, DisplayOrder, CreatedBy, CreatedAt, UpdatedAt
       FROM lab_token_packages
       WHERE LabId = ? AND IsActive = 1
       ORDER BY DisplayOrder ASC, TokenQuantity ASC`,
      [lId]
    );
    return rows;
  }

  async getAllPackages(db = pool) {
    const [rows] = await db.query(
      `SELECT Id, LabId, TokenQuantity, PriceAmount, Currency, IsActive, DisplayOrder, CreatedBy, CreatedAt, UpdatedAt
       FROM lab_token_packages
       ORDER BY LabId ASC, DisplayOrder ASC, TokenQuantity ASC`
    );
    return rows;
  }

  async updatePackage(id, { priceAmount, tokenQuantity, isActive, displayOrder }, db = pool) {
    const updates = ["UpdatedAt = CURRENT_TIMESTAMP"];
    const params = [];

    if (priceAmount !== undefined) {
      updates.push("PriceAmount = ?");
      params.push(Number(priceAmount) || 0);
    }
    if (tokenQuantity !== undefined) {
      updates.push("TokenQuantity = ?");
      params.push(Number(tokenQuantity) || 0);
    }
    if (isActive !== undefined) {
      updates.push("IsActive = ?");
      params.push(isActive ? 1 : 0);
    }
    if (displayOrder !== undefined) {
      updates.push("DisplayOrder = ?");
      params.push(Number(displayOrder) || 0);
    }

    params.push(id);
    await db.query(
      `UPDATE lab_token_packages SET ${updates.join(", ")} WHERE Id = ?`,
      params
    );
    return await this.getPackageById(id, db);
  }

  async setPackageStatus(id, isActive, db = pool) {
    await db.query(
      `UPDATE lab_token_packages SET IsActive = ?, UpdatedAt = CURRENT_TIMESTAMP WHERE Id = ?`,
      [isActive ? 1 : 0, id]
    );
    return await this.getPackageById(id, db);
  }
}

export const labTokenPackageRepository = new LabTokenPackageRepository();
export default labTokenPackageRepository;
