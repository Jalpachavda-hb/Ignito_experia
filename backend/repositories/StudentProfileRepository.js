import pool from "../lib/mysql.js";

class StudentProfileRepository {
  async findByUserId(userId) {
    const [rows] = await pool.query(
      "SELECT * FROM StudentProfiles WHERE UserId = ? AND DeletedAt IS NULL",
      [userId]
    );
    return rows[0] || null;
  }

  async findByExternalStudentId(externalStudentId) {
    const [rows] = await pool.query(
      "SELECT * FROM StudentProfiles WHERE ExternalStudentId = ? AND DeletedAt IS NULL",
      [externalStudentId]
    );
    return rows[0] || null;
  }

  async insert(profileData, connection = pool) {
    const {
      UserId = null,
      ExternalStudentId = null,
      UniversityId = null,
      FirstName,
      LastName,
      Email,
      Mobile = null,
      DepartmentId = null,
      ProgramId = null,
      SemesterId = null,
      Batch = null,
      Section = null,
      AuthenticationSource,
      Status = 'Active'
    } = profileData;

    const [result] = await connection.query(
      `INSERT INTO StudentProfiles (
        UserId, ExternalStudentId, UniversityId, FirstName, LastName, 
        Email, Mobile, DepartmentId, ProgramId, SemesterId, Batch, 
        Section, AuthenticationSource, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        UserId, ExternalStudentId, UniversityId, FirstName, LastName,
        Email, Mobile, DepartmentId, ProgramId, SemesterId, Batch,
        Section, AuthenticationSource, Status
      ]
    );

    return result.insertId;
  }

  async findAndCountAll(filters, pagination, sort) {
    let query = "SELECT * FROM StudentProfiles WHERE DeletedAt IS NULL";
    let countQuery = "SELECT COUNT(*) as total FROM StudentProfiles WHERE DeletedAt IS NULL";
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
      query += " AND (FirstName LIKE ? OR LastName LIKE ? OR Email LIKE ? OR ExternalStudentId LIKE ?)";
      countQuery += " AND (FirstName LIKE ? OR LastName LIKE ? OR Email LIKE ? OR ExternalStudentId LIKE ?)";
      const searchStr = `%${filters.search}%`;
      values.push(searchStr, searchStr, searchStr, searchStr);
    }

    // Sort
    const validSortFields = ['FirstName', 'LastName', 'Email', 'CreatedAt', 'LastLogin', 'Status'];
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

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findById(profileId, connection = pool) {
    const [rows] = await connection.query(
      "SELECT * FROM StudentProfiles WHERE StudentProfileId = ? AND DeletedAt IS NULL",
      [profileId]
    );
    return rows[0] || null;
  }

  async update(profileId, updateData, connection = pool) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(profileId);
    await connection.query(
      `UPDATE StudentProfiles SET ${fields.join(", ")} WHERE StudentProfileId = ?`,
      values
    );
  }

  async updateLastLogin(profileId, connection = pool) {
    await connection.query(
      "UPDATE StudentProfiles SET LastLogin = NOW() WHERE StudentProfileId = ?",
      [profileId]
    );
  }
}

export const studentProfileRepository = new StudentProfileRepository();
export default studentProfileRepository;
