import { auditService } from "../services/AuditService.js";
import { auditExportService } from "../services/AuditExportService.js";
import { auditStatisticsService } from "../services/AuditStatisticsService.js";

// GET /admin/audit/statistics
export const auditStatisticsHandler = async () => {
  const stats = await auditStatisticsService.getDashboardStatistics();
  return { statusCode: 200, body: JSON.stringify({ success: true, statistics: stats }) };
};

// GET /admin/audit
export const auditListHandler = async ({ queryStringParameters }) => {
  const filters = { ...queryStringParameters };
  
  // Extract pagination
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  delete filters.page;
  delete filters.limit;

  const result = await auditService.searchLogs(filters, { page, limit });
  return { statusCode: 200, body: JSON.stringify({ success: true, ...result }) };
};

// GET /admin/audit/export/csv
export const auditExportCsvHandler = async ({ queryStringParameters }) => {
  const filters = { ...queryStringParameters };
  
  // We use the Export Service to handle generation
  const csvBuffer = await auditExportService.exportCsv(filters);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=audit_export.csv"
    },
    body: csvBuffer
  };
};

// Stub for Excel
export const auditExportExcelHandler = async ({ queryStringParameters }) => {
  try {
    await auditExportService.exportExcel(queryStringParameters);
  } catch (err) {
    return { statusCode: 501, body: JSON.stringify({ success: false, message: err.message }) };
  }
};

// Stub for PDF
export const auditExportPdfHandler = async ({ queryStringParameters }) => {
  try {
    await auditExportService.exportPdf(queryStringParameters);
  } catch (err) {
    return { statusCode: 501, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
