import pool from "../lib/mysql.js";

class AuditRepository {
  async insert(auditData, connection = pool) {
    const {
      RequestId = null,
      CorrelationId = null,
      TraceId = null,
      SessionId = null,
      UserId = null,
      StudentProfileId = null,
      UniversityId = null,
      DepartmentId = null,
      ProgramId = null,
      SemesterId = null,
      Source = null,
      AuthenticationSource = null,
      Category = 'Authentication',
      Severity = 'Information',
      Action,
      Module = null,
      Entity = null,
      EntityId = null,
      Description = null,
      OldValues = null,
      NewValues = null,
      IPAddress = null,
      Browser = null,
      Device = null,
      OperatingSystem = null,
      OS = null,
      Country = null,
      City = null,
      Status = 'Success'
    } = auditData;

    const finalSource = Source || AuthenticationSource || 'SYSTEM';
    const finalOS = OperatingSystem || OS;
    const oldVals = OldValues ? JSON.stringify(OldValues) : null;
    const newVals = NewValues ? JSON.stringify(NewValues) : null;

    const [result] = await connection.query(
      `INSERT INTO AuditLogs (
        RequestId, CorrelationId, TraceId, SessionId, UserId, 
        UniversityId, DepartmentId, ProgramId, SemesterId, Source, Category, Severity, 
        Action, Module, Entity, EntityId, Description, OldValues, NewValues, 
        IPAddress, Browser, Device, OperatingSystem, Country, City, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        RequestId, CorrelationId, TraceId, SessionId, UserId || StudentProfileId,
        UniversityId, DepartmentId, ProgramId, SemesterId, finalSource, Category, Severity,
        Action, Module, Entity, EntityId, Description, oldVals, newVals,
        IPAddress, Browser, Device, finalOS, Country, City, Status
      ]
    );

    return result.insertId;
  }
  async search(filters, offset, limit) {
    if (filters.StudentProfileId !== undefined && filters.UserId === undefined) {
      filters.UserId = filters.StudentProfileId;
    }

    let query = `
      SELECT a.*, u.FullName AS UserFullName, u.Email AS UserEmail 
      FROM AuditLogs a
      LEFT JOIN Users u ON a.UserId = u.UserId
      WHERE 1=1
    `;
    const values = [];

    const allowedFilters = [
      'Category', 'Severity', 'Action', 'Source', 'Status', 
      'UniversityId', 'DepartmentId', 'UserId', 'CorrelationId'
    ];

    for (const field of allowedFilters) {
      if (filters[field] !== undefined) {
        query += ` AND a.${field} = ?`;
        values.push(filters[field]);
      }
    }

    if (filters.startDate) {
      query += " AND a.CreatedAt >= ?";
      values.push(filters.startDate);
    }
    if (filters.endDate) {
      query += " AND a.CreatedAt <= ?";
      values.push(filters.endDate);
    }

    query += " ORDER BY a.CreatedAt DESC LIMIT ? OFFSET ?";
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, values);

    let countQuery = "SELECT COUNT(*) as total FROM AuditLogs a WHERE 1=1";
    const countValues = values.slice(0, -2); 
    const countQueryString = query.replace("SELECT a.*, u.FullName AS UserFullName, u.Email AS UserEmail", "SELECT COUNT(*) as total").split("ORDER BY")[0];
    const [countRows] = await pool.query(countQueryString, countValues);

    return { rows, total: countRows[0].total };
  }
}

export const auditRepository = new AuditRepository();
export default auditRepository;
