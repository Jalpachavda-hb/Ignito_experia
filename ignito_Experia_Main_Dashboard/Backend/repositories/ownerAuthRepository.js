import pool from "../config/db.js";

class OwnerAuthRepository {
  async findByEmail(email) {
    const [rows] = await pool.query(
      "SELECT `OwnerId`, `FullName`, `Email`, `PhoneNumber`, `Designation`, `Organization`, `AvatarUrl`, `PasswordHash`, `Role`, `Status` FROM `owner_users` WHERE `Email` = ? AND `Status` = 'active' LIMIT 1",
      [email]
    );
    return rows[0] || null;
  }

  async findById(ownerId) {
    const [rows] = await pool.query(
      "SELECT `OwnerId`, `FullName`, `Email`, `PhoneNumber`, `Designation`, `Organization`, `AvatarUrl`, `Role`, `Status` FROM `owner_users` WHERE `OwnerId` = ? LIMIT 1",
      [ownerId]
    );
    return rows[0] || null;
  }

  async updateOwnerProfile(ownerId, data) {
    const fields = [];
    const values = [];

    if (data.fullName !== undefined) {
      fields.push("`FullName` = ?");
      values.push(data.fullName);
    }
    if (data.email !== undefined) {
      fields.push("`Email` = ?");
      values.push(data.email);
    }
    if (data.phoneNumber !== undefined) {
      fields.push("`PhoneNumber` = ?");
      values.push(data.phoneNumber);
    }
    if (data.designation !== undefined) {
      fields.push("`Designation` = ?");
      values.push(data.designation);
    }
    if (data.organization !== undefined) {
      fields.push("`Organization` = ?");
      values.push(data.organization);
    }
    if (data.avatarUrl !== undefined) {
      fields.push("`AvatarUrl` = ?");
      values.push(data.avatarUrl);
    }
    if (data.passwordHash) {
      fields.push("`PasswordHash` = ?");
      values.push(data.passwordHash);
    }

    fields.push("`UpdatedDate` = NOW()");

    values.push(ownerId);

    const sql = `UPDATE \`owner_users\` SET ${fields.join(", ")} WHERE \`OwnerId\` = ?`;
    await pool.query(sql, values);
    return await this.findById(ownerId);
  }
}

export const ownerAuthRepository = new OwnerAuthRepository();

