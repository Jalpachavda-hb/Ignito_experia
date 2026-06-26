import { auditService } from "./AuditService.js";
class AuditExportService {
  
  /**
   * Generates a raw CSV string buffer.
   */
  async exportCsv(filters) {
    // Fetch a large unbounded limit or streaming chunked approach for exports
    const result = await auditService.searchLogs(filters, { page: 1, limit: 10000 });
    const data = result.data;

    if (!data || data.length === 0) {
      return "No data found";
    }

    // Manual CSV generation since we might not have 'json2csv' installed
    const header = Object.keys(data[0]).join(",");
    const rows = data.map(row => {
      return Object.values(row).map(val => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
    });

    return [header, ...rows].join("\n");
  }

  /**
   * Stubs for Excel and PDF to be implemented using exceljs and pdfkit
   */
  async exportExcel(filters) {
    throw new Error("Excel export requires 'exceljs' package to be installed manually.");
  }

  async exportPdf(filters) {
    throw new Error("PDF export requires 'pdfkit' package to be installed manually.");
  }
}

export const auditExportService = new AuditExportService();
export default auditExportService;
