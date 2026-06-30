import pool from "../config/db.js";

class OwnerAuthRepository {
  async findByEmail(email) {
    const [rows] = await pool.query(
      "SELECT `OwnerId`, `Email`, `PhoneNumber`, `PasswordHash`, `Role`, `Status` FROM `owner_users` WHERE `Email` = ? AND `Status` = 'active' LIMIT 1",
      [email]
    );
    return rows[0] || null;
  }
}

export const ownerAuthRepository = new OwnerAuthRepository();
