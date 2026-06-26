import studentProfileRepository from "../repositories/StudentProfileRepository.js";
import { auditService } from "./AuditService.js";
import { cacheProvider } from "../lib/cache.js";
import { badRequest, notFound } from "../lib/errors.js";
import pool from "../lib/mysql.js";

class StudentCommandService {
  async updateStudent(profileId, updateData, changedByUserId) {
    const profile = await studentProfileRepository.findById(profileId);
    if (!profile) throw notFound("Student profile not found");

    if (profile.AuthenticationSource === 'LMS' && updateData.Password) {
      throw badRequest("Cannot update password for an LMS-authenticated student");
    }

    const updates = {};
    const changes = [];

    // Compare old vs new
    const updatableFields = [
      'FirstName', 'LastName', 'Email', 'Mobile', 
      'DepartmentId', 'ProgramId', 'SemesterId', 
      'Batch', 'Section', 'Status'
    ];

    for (const field of updatableFields) {
      if (updateData[field] !== undefined && updateData[field] !== profile[field]) {
        updates[field] = updateData[field];
        changes.push({
          field,
          oldValue: profile[field],
          newValue: updateData[field]
        });
      }
    }

    if (Object.keys(updates).length === 0) {
      return { message: "No changes detected", profile };
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await studentProfileRepository.update(profileId, updates, connection);
      
      // Automatic audit logging
      await auditService.log({ StudentProfileId: profileId, Action: 'UPDATE', UserId: changedByUserId, Module: 'Students', NewValues: changes });

      await connection.commit();
      connection.release();

      // Invalidate caches
      await cacheProvider.clear(); // For safety, clearing all. In prod, use prefix-based deletion

      return {
        message: "Student updated successfully",
        changes
      };
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  }

  async deactivateStudent(profileId, changedByUserId) {
    return this.updateStudent(profileId, { Status: 'INACTIVE' }, changedByUserId);
  }
}

export const studentCommandService = new StudentCommandService();
export default studentCommandService;
