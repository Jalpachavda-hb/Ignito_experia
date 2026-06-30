import pool from "../lib/mysql.js";

class StudentProfileRepository {
  async findByUserId(userId) {
    const [rows] = await pool.query(
      "SELECT * FROM Users WHERE UserId = ? AND Role = 'Student' AND IsDeleted = 0",
      [userId]
    );
    return rows[0] || null;
  }

  async findByExternalStudentId(externalStudentId) {
    const [rows] = await pool.query(
      "SELECT * FROM Users WHERE ExternalStudentId = ? AND Role = 'Student' AND IsDeleted = 0",
      [externalStudentId]
    );
    return rows[0] || null;
  }

  async insert(profileData, connection = pool) {
    const {
      UserId,
      ExternalStudentId,
      UniversityId,
      FirstName,
      LastName,
      Email,
      Mobile,
      DepartmentId,
      ProgramId,
      SemesterId,
      Batch,
      Section,
      AuthenticationSource,
      Status
    } = profileData;

    await connection.query(
      `UPDATE Users SET 
         ExternalStudentId = ?, 
         UniversityId = ?, 
         Mobile = ?, 
         DepartmentId = ?, 
         ProgramId = ?, 
         SemesterId = ?, 
         Batch = ?, 
         Section = ?, 
         AuthenticationSource = ?, 
         Status = ?
       WHERE UserId = ?`,
      [
        ExternalStudentId,
        UniversityId,
        Mobile,
        DepartmentId,
        ProgramId,
        SemesterId,
        Batch,
        Section,
        AuthenticationSource,
        Status,
        UserId
      ]
    );

    return UserId; // Use UserId as profileId
  }

  async findAndCountAll(filters, pagination, sort) {
    let query = "SELECT * FROM Users WHERE Role = 'Student' AND IsDeleted = 0";
    let countQuery = "SELECT COUNT(*) as total FROM Users WHERE Role = 'Student' AND IsDeleted = 0";
    const values = [];

    // Filters
    if (filters.status) {
      query += " AND Status = ?";
      countQuery += " AND Status = ?";
      values.push(filters.status);
    }
    if (filters.source) {
      query += " AND AuthenticationSource = ?";
      countQuery += " AND AuthenticationSource = ?";
      values.push(filters.source);
    }
    if (filters.universityId) {
      query += " AND UniversityId = ?";
      countQuery += " AND UniversityId = ?";
      values.push(filters.universityId);
    }
    if (filters.departmentId) {
      query += " AND DepartmentId = ?";
      countQuery += " AND DepartmentId = ?";
      values.push(filters.departmentId);
    }
    if (filters.semesterId) {
      query += " AND SemesterId = ?";
      countQuery += " AND SemesterId = ?";
      values.push(filters.semesterId);
    }
    if (filters.programId) {
      query += " AND ProgramId = ?";
      countQuery += " AND ProgramId = ?";
      values.push(filters.programId);
    }
    if (filters.search) {
      query += " AND (FullName LIKE ? OR Email LIKE ? OR ExternalStudentId LIKE ?)";
      countQuery += " AND (FullName LIKE ? OR Email LIKE ? OR ExternalStudentId LIKE ?)";
      const searchStr = `%${filters.search}%`;
      values.push(searchStr, searchStr, searchStr);
    }

    // Sort
    const validSortFields = ['FullName', 'Email', 'CreatedAt', 'LastLoginAt', 'Status'];
    const sortBy = validSortFields.includes(sort.sortBy) ? sort.sortBy : 'CreatedAt';
    const sortOrder = sort.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination
    const page = Math.max(1, parseInt(pagination.page) || 1);
    const limit = Math.max(1, parseInt(pagination.limit) || 10);
    const offset = (page - 1) * limit;

    query += " LIMIT ? OFFSET ?";
    
    // Exec count
    const [countRows] = await pool.query(countQuery, values);
    const total = countRows[0].total;

    // Exec data
    const queryValues = [...values, limit, offset];
    const [rows] = await pool.query(query, queryValues);

    // Map fields to match StudentProfile compatibility
    const data = rows.map(r => ({
      ...r,
      StudentProfileId: r.UserId,
      FirstName: r.FullName ? r.FullName.split(" ")[0] : "",
      LastName: r.FullName ? r.FullName.split(" ").slice(1).join(" ") : "",
      LastLogin: r.LastLoginAt
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(profileId, connection = pool) {
    const [rows] = await connection.query(
      "SELECT * FROM Users WHERE UserId = ? AND IsDeleted = 0",
      [profileId]
    );
    if (!rows[0]) return null;

    // Map fields to match StudentProfile compatibility
    const r = rows[0];
    return {
      ...r,
      StudentProfileId: r.UserId,
      FirstName: r.FullName ? r.FullName.split(" ")[0] : "",
      LastName: r.FullName ? r.FullName.split(" ").slice(1).join(" ") : "",
      LastLogin: r.LastLoginAt
    };
  }

  async update(profileId, updateData, connection = pool) {
    const fields = [];
    const values = [];

    // Map field names from StudentProfile schema to Users schema if needed
    const fieldMapping = {
      LastLogin: 'LastLoginAt',
      FirstName: null, // full name is updated instead
      LastName: null
    };

    let fullNameUpdates = { firstName: '', lastName: '' };
    const [existing] = await connection.query("SELECT FullName FROM Users WHERE UserId = ?", [profileId]);
    if (existing[0] && existing[0].FullName) {
      const parts = existing[0].FullName.split(" ");
      fullNameUpdates.firstName = parts[0] || '';
      fullNameUpdates.lastName = parts.slice(1).join(" ") || '';
    }

    for (let [key, value] of Object.entries(updateData)) {
      if (key === 'FirstName') {
        fullNameUpdates.firstName = value;
        continue;
      }
      if (key === 'LastName') {
        fullNameUpdates.lastName = value;
        continue;
      }

      const dbKey = fieldMapping[key] !== undefined ? fieldMapping[key] : key;
      if (dbKey === null) continue;

      fields.push(`${dbKey} = ?`);
      values.push(value);
    }

    if (fullNameUpdates.firstName || fullNameUpdates.lastName) {
      fields.push("FullName = ?");
      values.push(`${fullNameUpdates.firstName} ${fullNameUpdates.lastName}`.trim());
    }

    if (fields.length === 0) return;

    values.push(profileId);
    await connection.query(
      `UPDATE Users SET ${fields.join(", ")} WHERE UserId = ?`,
      values
    );
  }

  async updateLastLogin(profileId, connection = pool) {
    await connection.query(
      "UPDATE Users SET LastLoginAt = NOW() WHERE UserId = ?",
      [profileId]
    );
  }
}

export const studentProfileRepository = new StudentProfileRepository();
export default studentProfileRepository;
