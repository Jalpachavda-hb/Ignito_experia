import { ok } from "../lib/apigw.js";
import { unauthorized, notFound } from "../lib/errors.js";
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

  try {
    const isLmsCandidate = auth?.authType === 'LMS' ||
      auth?.authType === 'LMS_AND_DIRECT' ||
      auth?.isLmsStudent ||
      Boolean(auth?.externalStudentId || auth?.studentDegreeAdmissionId || auth?.studentId) ||
      (tenantId && String(tenantId).toUpperCase() !== 'PLATFORM' && String(tenantId).toUpperCase() !== 'DIRECT');

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

              if (!groupedWallets.has(cleanLabId)) {
                groupedWallets.set(cleanLabId, {
                  id: 0,
                  labId: cleanLabId,
                  labTitle,
                  purchasedTokens: practicalCredit,
                  allocatedTokens: practicalCredit,
                  usedTokens: 0,
                  remainingTokens: practicalCredit,
                  runtimeRemainingMinutes: practicalCredit,
                  updatedAt: new Date().toISOString()
                });
              } else {
                const existing = groupedWallets.get(cleanLabId);
                if (existing.purchasedTokens < practicalCredit) {
                  existing.purchasedTokens = practicalCredit;
                  existing.remainingTokens = Math.max(0, existing.purchasedTokens - existing.usedTokens);
                  existing.runtimeRemainingMinutes = existing.remainingTokens;
                }
                existing.allocatedTokens = existing.purchasedTokens;
                if (!existing.labTitle || existing.labTitle === `${cleanLabId.toUpperCase()} Lab`) {
                  existing.labTitle = labTitle;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[studentLabTokensSummaryHandler] LMS enrichment skipped:", err.message);
  }

  const labWallets = Array.from(groupedWallets.values());
  let totalPurchased = 0;
  let totalUsed = 0;
  let totalRemaining = 0;

  labWallets.forEach(w => {
    totalPurchased += w.purchasedTokens;
    totalUsed += w.usedTokens;
    totalRemaining += w.remainingTokens;
  });

  return ok({
    isUniversityStudent,
    universityName,
    summary: {
      totalPurchased,
      totalAllocated: totalPurchased,
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

  const wallet = await studentLabTokenWalletRepository.getWallet(tenantId, auth.userId, labId, auth.email);
  return ok({
    labId,
    purchasedTokens: wallet ? Number(wallet.TotalPurchasedTokens) : 0,
    usedTokens: wallet ? Number(wallet.ConsumedTokens) : 0,
    remainingTokens: wallet ? Number(wallet.RemainingTokens) : 0
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
