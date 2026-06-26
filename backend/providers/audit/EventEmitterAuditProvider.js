import { EventEmitter } from "events";
import { IAuditProvider } from "./IAuditProvider.js";
import pool from "../../lib/mysql.js";

const internalEmitter = new EventEmitter();

// Handle the background execution
internalEmitter.on("audit_log", async (payload) => {
  try {
    const query = `
      INSERT INTO AuditLogs (
        RequestId, CorrelationId, TraceId, SessionId, StudentProfileId, 
        UniversityId, DepartmentId, ProgramId, SemesterId, 
        Source, Category, Severity, Action, Module, Entity, EntityId, Description, 
        OldValues, NewValues, IPAddress, Browser, Device, OperatingSystem, 
        Country, City, Status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      payload.RequestId || null, payload.CorrelationId || null, payload.TraceId || null,
      payload.SessionId || null, payload.StudentProfileId || null, 
      payload.UniversityId || null, payload.DepartmentId || null, payload.ProgramId || null, payload.SemesterId || null,
      payload.Source || 'SYSTEM', payload.Category || 'System', payload.Severity || 'Information', payload.Action,
      payload.Module || null, payload.Entity || null, payload.EntityId || null, payload.Description || null,
      payload.OldValues ? JSON.stringify(payload.OldValues) : null,
      payload.NewValues ? JSON.stringify(payload.NewValues) : null,
      payload.IPAddress || null, payload.Browser || null, payload.Device || null, payload.OperatingSystem || null,
      payload.Country || null, payload.City || null, payload.Status || 'SUCCESS'
    ];

    await pool.query(query, values);
  } catch (error) {
    // We swallow errors here because audit logs should never crash the main application,
    // but in a real enterprise app, we'd log this meta-failure to CloudWatch or Datadog.
    console.error("[AuditProvider] Failed to insert audit log async:", error);
  }
});

export class EventEmitterAuditProvider extends IAuditProvider {
  async emitEvent(eventPayload) {
    // Non-blocking emit
    internalEmitter.emit("audit_log", eventPayload);
  }
}
