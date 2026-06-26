import auditRepository from "../repositories/AuditRepository.js";

class AuditService {
  async log(payload) {
    try {
      await auditRepository.insert(payload);
    } catch (err) {
      console.error("Audit Logging Failed:", err);
    }
  }

  async searchLogs(filters = {}, pagination = {}) {
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    const { rows, total } = await auditRepository.search(filters, offset, limit);

    return {
      data: rows,
      total,
      page,
      limit
    };
  }
}

export const auditService = new AuditService();
export default auditService;
