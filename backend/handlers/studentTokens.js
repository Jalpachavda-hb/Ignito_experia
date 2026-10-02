import { ok } from "../lib/apigw.js";
import { unauthorized, notFound } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";
import labTokenUsageRepository from "../repositories/LabTokenUsageRepository.js";
import { loadStudentLmsContext, loadOwnedProgrammes } from "../services/lms/studentLmsContext.js";
import { lmsCourseService } from "../services/lms/LmsCourseService.js";

export const studentLabTokensSummaryHandler = async ({ auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "DIRECT";
  const studentId = auth.userId;

  const wallets = await studentLabTokenWalletRepository.getAllWalletsForStudent(tenantId, studentId, auth.email);

  // Group & deduplicate by clean lab identifier
  const groupedWallets = new Map();
  wallets.forEach(w => {
    const rawId = String(w.LabId || '').toLowerCase().trim();
    const cleanId = rawId.replace(/^lab-/, '').replace(/-lab$/, '');
    const purchased = Number(w.TotalPurchasedTokens || 0);
    const used = Number(w.ConsumedTokens || 0);
    const remaining = Math.max(0, Number(w.RemainingTokens ?? (purchased - used)));

    if (!groupedWallets.has(cleanId)) {
      groupedWallets.set(cleanId, {
        id: w.Id,
        labId: cleanId,
        purchasedTokens: purchased,
        allocatedTokens: purchased,
        usedTokens: used,
        remainingTokens: Math.max(0, purchased - used),
        runtimeRemainingMinutes: Math.max(0, purchased - used),
        updatedAt: w.UpdatedAt
      });
    } else {
      const existing = groupedWallets.get(cleanId);
      existing.purchasedTokens += purchased;
      existing.allocatedTokens = (existing.allocatedTokens || 0) + purchased;
      existing.usedTokens += used;
      existing.remainingTokens = Math.max(0, existing.purchasedTokens - existing.usedTokens);
      existing.runtimeRemainingMinutes = existing.remainingTokens;
    }
  });

  // Check if student is an LMS / University student and enrich with their assigned course practical tokens
  let isUniversityStudent = false;
  let universityName = null;
  const courseAllocations = [];

  const isLmsCandidate = auth?.authType === 'LMS' ||
    auth?.authType === 'LMS_AND_DIRECT' ||
    auth?.isLmsStudent ||
    Boolean(auth?.externalStudentId || auth?.studentDegreeAdmissionId || auth?.studentId) ||
    (tenantId && String(tenantId).toUpperCase() !== 'PLATFORM' && String(tenantId).toUpperCase() !== 'DIRECT');

  try {
    if (isLmsCandidate) {
      const ctx = await loadStudentLmsContext(auth).catch(() => null);
      if (ctx?.universityStudent && ctx?.tenant) {
        isUniversityStudent = true;
        universityName = ctx.tenant.Name || ctx.tenant.TenantName || "University";
        const owned = await loadOwnedProgrammes(ctx).catch(() => ({ programmes: [] }));
        const programmes = owned?.programmes || [];

        for (const prog of programmes) {
          const pId = prog.programmeId || prog.programId;
          if (!pId) continue;
          const courseRes = await lmsCourseService.getByProgramme({
            tenantId: ctx.tenant.TenantId,
            provider: ctx.provider,
            programmeId: pId,
            semester: prog.currentSemester || null,
            externalStudentId: ctx.externalStudentId
          }).catch(() => null);

          const courses = courseRes?.courseList || [];
          for (const course of courses) {
            const practicalCredit = Number(course.practicalCredit || course.credits || 60);
            const mappedLabObj = course.mappedLab || (course.labId ? { labId: course.labId, title: course.labTitle } : null);
            const rawLabId = String(mappedLabObj?.labId || mappedLabObj?.LabId || course.labId || '').toLowerCase().trim();
            const cleanLabId = rawLabId.replace(/^lab-/, '').replace(/-lab$/, '');

            if (cleanLabId) {
              const labTitle = mappedLabObj?.title || course.mappedLab?.title || `${cleanLabId.toUpperCase()} Lab`;
              courseAllocations.push({
                courseCode: course.courseCode || course.code,
                courseName: course.courseName || course.name,
                programmeName: prog.programmeName || prog.programName,
                labId: cleanLabId,
                labTitle,
                allocatedTokens: practicalCredit
              });
            }
          }
        }
      }

      // If no allocations found from external LMS API, fallback to course_lab_mappings in database
      if (courseAllocations.length === 0) {
        const [dbMappings] = await pool.query(
          `SELECT course_code, lab_id FROM course_lab_mappings WHERE tenant_id = ? OR tenant_id = 'PLATFORM'`,
          [tenantId || 'PLATFORM']
        ).catch(() => [[]]);

        if (Array.isArray(dbMappings) && dbMappings.length > 0) {
          isUniversityStudent = true;
          dbMappings.forEach((m) => {
            const cleanLabId = String(m.lab_id).toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
            let labTitle = `${cleanLabId.toUpperCase()} Lab`;
            if (cleanLabId.includes('dbms')) labTitle = 'Relational Database Management Systems';
            else if (cleanLabId.includes('linux')) labTitle = 'Programming with C';
            else if (cleanLabId.includes('dotnet')) labTitle = 'Web Technology Using .NET';
            else if (cleanLabId.includes('python')) labTitle = 'Python Programming';
            else if (cleanLabId.includes('java')) labTitle = 'Java Development';

            if (!courseAllocations.some((ca) => ca.labId === cleanLabId && ca.courseCode === m.course_code)) {
              courseAllocations.push({
                courseCode: m.course_code,
                courseName: labTitle,
                labId: cleanLabId,
                labTitle,
                allocatedTokens: 60
              });
            }
          });
        }
      }

      // Auto-provision and enrich wallets with university allocations
      for (const ca of courseAllocations) {
        const cleanLabId = ca.labId;
        const practicalCredit = Number(ca.allocatedTokens || 60);

        if (groupedWallets.has(cleanLabId)) {
          const existing = groupedWallets.get(cleanLabId);
          existing.allocatedTokens = Math.max(existing.allocatedTokens || 0, practicalCredit);
          existing.purchasedTokens = Math.max(existing.purchasedTokens || 0, practicalCredit);
          existing.remainingTokens = Math.max(0, existing.purchasedTokens - existing.usedTokens);
          existing.runtimeRemainingMinutes = existing.remainingTokens;
          if (!existing.labTitle || existing.labTitle === `${cleanLabId.toUpperCase()} Lab`) {
            existing.labTitle = ca.labTitle;
          }
        } else {
          groupedWallets.set(cleanLabId, {
            id: `uni-${cleanLabId}`,
            labId: cleanLabId,
            labTitle: ca.labTitle,
            purchasedTokens: practicalCredit,
            allocatedTokens: practicalCredit,
            usedTokens: 0,
            remainingTokens: practicalCredit,
            runtimeRemainingMinutes: practicalCredit,
            updatedAt: new Date().toISOString()
          });
        }

        // Persist/ensure wallet in student_lab_token_wallets table so session start & billing succeed
        try {
          await pool.query(
            `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
             VALUES (?, ?, ?, ?, 0, ?, 1)
             ON DUPLICATE KEY UPDATE
               TotalPurchasedTokens = IF(TotalPurchasedTokens = 0, VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
               RemainingTokens = IF(TotalPurchasedTokens = 0, VALUES(RemainingTokens), RemainingTokens)`,
            [tenantId || 'DEFAULT', String(studentId), cleanLabId, practicalCredit, practicalCredit]
          );
          if (auth?.email && String(auth.email).toLowerCase() !== String(studentId).toLowerCase()) {
            await pool.query(
              `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
               VALUES (?, ?, ?, ?, 0, ?, 1)
               ON DUPLICATE KEY UPDATE
                 TotalPurchasedTokens = IF(TotalPurchasedTokens = 0, VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
                 RemainingTokens = IF(TotalPurchasedTokens = 0, VALUES(RemainingTokens), RemainingTokens)`,
              [tenantId || 'DEFAULT', String(auth.email).toLowerCase(), cleanLabId, practicalCredit, practicalCredit]
            ).catch(() => {});
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn("[studentLabTokensSummaryHandler] LMS enrichment skipped:", err.message);
  }

  const labWallets = Array.from(groupedWallets.values());
  let totalPurchased = 0;
  let totalAllocated = 0;
  let totalUsed = 0;
  let totalRemaining = 0;

  labWallets.forEach(w => {
    totalPurchased += Number(w.purchasedTokens || 0);
    totalAllocated += Number(w.allocatedTokens || w.purchasedTokens || 0);
    totalUsed += Number(w.usedTokens || 0);
    totalRemaining += Number(w.remainingTokens || 0);
  });

  return ok({
    isUniversityStudent,
    universityName,
    summary: {
      totalPurchased,
      totalAllocated,
      totalUsed,
      totalRemaining
    },
    labs: labWallets,
    courseAllocations
  });
};

export const studentLabSingleTokenBalanceHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || null;
  const labId = pathParameters?.labId;

  let wallet = await studentLabTokenWalletRepository.getWallet(tenantId, auth.userId, labId, auth.email);

  const isLmsStudent = auth?.authType === 'LMS' ||
    auth?.authType === 'LMS_AND_DIRECT' ||
    auth?.isLmsStudent ||
    Boolean(auth?.externalStudentId || auth?.studentDegreeAdmissionId || auth?.studentId) ||
    (tenantId && String(tenantId).toUpperCase() !== 'PLATFORM' && String(tenantId).toUpperCase() !== 'DIRECT');

  let purchasedTokens = wallet ? Number(wallet.TotalPurchasedTokens) : 0;
  let usedTokens = wallet ? Number(wallet.ConsumedTokens) : 0;
  let remainingTokens = wallet ? Number(wallet.RemainingTokens) : 0;

  if (isLmsStudent && remainingTokens <= 0 && usedTokens === 0) {
    purchasedTokens = 60;
    remainingTokens = 60;
  }

  return ok({
    labId,
    purchasedTokens,
    usedTokens,
    remainingTokens
  });
};

export const studentAvailableTokenPackagesHandler = async () => {
  const allPackages = await labTokenPackageRepository.getAllPackages();
  const activePackages = allPackages.filter(p => p.IsActive);

  // Group by labId
  const groupedByLab = {};
  for (const pkg of activePackages) {
    if (!groupedByLab[pkg.LabId]) {
      groupedByLab[pkg.LabId] = [];
    }
    groupedByLab[pkg.LabId].push(pkg);
  }

  return ok({
    packages: activePackages,
    labs: groupedByLab
  });
};

export const studentLabTokenUsageHandler = async ({ queryStringParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || null;
  const labId = queryStringParameters?.labId || null;
  const limit = Math.min(100, Math.max(1, Number(queryStringParameters?.limit || 50)));
  const offset = Math.max(0, Number(queryStringParameters?.offset || 0));

  const usageLogs = await labTokenUsageRepository.getStudentLabUsage(tenantId, auth.userId, labId, limit, offset);
  return ok({ usage: usageLogs });
};
