import { ok } from "../lib/apigw.js";
import { unauthorized, notFound } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import studentLabTokenTransactionRepository from "../repositories/StudentLabTokenTransactionRepository.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";
import labTokenUsageRepository from "../repositories/LabTokenUsageRepository.js";
import { canonicalLabKey } from "../lib/labIdentity.js";
import { loadStudentLmsContext, loadOwnedProgrammes } from "../services/lms/studentLmsContext.js";
import { lmsCourseService } from "../services/lms/LmsCourseService.js";

const toCleanLabId = (labId, hint = "") => canonicalLabKey(labId, hint);

export const studentLabTokensSummaryHandler = async ({ auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "DIRECT";
  const studentId = auth.userId;

  const wallets = await studentLabTokenWalletRepository.getAllWalletsForStudent(tenantId, studentId, auth.email);
  const { canonicalStudentId } = await studentLabTokenWalletRepository.resolveCanonicalStudent(studentId, auth.email);
  const identityKeys = [canonicalStudentId, String(studentId), auth.email];
  const purchasedByLab = await studentLabTokenTransactionRepository
    .getPurchasedTokensByLab(identityKeys)
    .catch((err) => {
      console.warn("[studentLabTokensSummaryHandler] purchase ledger unavailable:", err.message);
      return new Map();
    });
  const purchaseAliases = await studentLabTokenTransactionRepository
    .getPurchaseAliases(identityKeys)
    .catch(() => new Map());

  // A lab balance can be spread over several wallet rows (different tenant / identity keys).
  // Each billing tick lands on exactly one row, so consumption is summed across rows.
  // Rows may already include purchases, so entitlement is reconciled against the purchase
  // ledger later (max of largest row vs. allocation + purchases) instead of summing totals.
  const groupedWallets = new Map();
  wallets.forEach(w => {
    const rawLabId = String(w.LabId || "").toLowerCase().trim();
    const strippedLabId = rawLabId.replace(/^lab-/, "").replace(/-lab$/, "");
    const cleanId = purchaseAliases.get(rawLabId) || purchaseAliases.get(strippedLabId) || toCleanLabId(w.LabId);
    const total = Number(w.TotalPurchasedTokens || 0);
    const used = Number(w.ConsumedTokens || 0);
    const group = groupedWallets.get(cleanId);
    if (!group) {
      groupedWallets.set(cleanId, {
        id: w.Id,
        labId: cleanId,
        rows: [w],
        maxRowTotal: total,
        usedTokens: used,
        allocation: 0,
        updatedAt: w.UpdatedAt
      });
    } else {
      group.rows.push(w);
      group.maxRowTotal = Math.max(group.maxRowTotal, total);
      group.usedTokens += used;
      if (w.UpdatedAt && (!group.updatedAt || w.UpdatedAt > group.updatedAt)) group.updatedAt = w.UpdatedAt;
    }
  });

  const entitlementFor = (group) =>
    Math.max(group.maxRowTotal, (group.allocation || 0) + (purchasedByLab.get(group.labId) || 0));

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
            semester: null,
            externalStudentId: ctx.externalStudentId
          }).catch(() => null);

          const courses = courseRes?.courseList || [];
          for (const course of courses) {
            const mappedLabObj = course.mappedLab || (course.labId ? { labId: course.labId, title: course.labTitle } : null);
            const rawLabId = String(mappedLabObj?.labId || mappedLabObj?.LabId || course.labId || '').toLowerCase().trim();
            const codeStr = String(course.courseCode || course.code || '').toUpperCase();
            const courseNameLower = String(course.courseName || course.name || '').toLowerCase();
            const cleanLabId = canonicalLabKey(rawLabId, `${mappedLabObj?.title || ""} ${courseNameLower} ${codeStr}`);

            const defaultCredit = (cleanLabId.includes('dbms') || codeStr.includes('4031')) ? 90 : ((cleanLabId.includes('dotnet') || codeStr.includes('4011')) ? 80 : 60);
            const practicalCredit = Number(
              course.practicalCredit ||
              mappedLabObj?.practicalCredit ||
              mappedLabObj?.tokens ||
              mappedLabObj?.credits ||
              course.credits ||
              defaultCredit
            );

            if (cleanLabId) {
              const labTitle = mappedLabObj?.title || course.mappedLab?.title || (cleanLabId === 'dbms' ? 'Relational Database Management Systems' : (cleanLabId === 'dotnet' ? 'Programming with C' : `${cleanLabId.toUpperCase()} Lab`));
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
          `SELECT * FROM course_lab_mappings WHERE tenant_id = ? OR tenant_id = 'PLATFORM'`,
          [tenantId || 'PLATFORM']
        ).catch(() => [[]]);

        if (Array.isArray(dbMappings) && dbMappings.length > 0) {
          isUniversityStudent = true;
          dbMappings.forEach((m) => {
            const cleanLabId = String(m.lab_id).toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
            let labTitle = `${cleanLabId.toUpperCase()} Lab`;
            const codeStr = String(m.course_code || '').toUpperCase();
            let practicalCredit = Number(m.practical_credit) || ((cleanLabId.includes('dbms') || codeStr.includes('4031')) ? 90 : ((cleanLabId.includes('dotnet') || codeStr.includes('4011')) ? 80 : 60));
            if (cleanLabId.includes('dbms')) {
              labTitle = 'Relational Database Management Systems';
            } else if (cleanLabId.includes('dotnet')) {
              labTitle = 'Web Technology Using .NET';
            } else if (cleanLabId.includes('python')) {
              labTitle = 'Python Programming';
            } else if (cleanLabId.includes('java')) {
              labTitle = 'Java Development';
            }

            if (!courseAllocations.some((ca) => ca.labId === cleanLabId && ca.courseCode === m.course_code)) {
              courseAllocations.push({
                courseCode: m.course_code,
                courseName: labTitle,
                labId: cleanLabId,
                labTitle,
                allocatedTokens: practicalCredit
              });
            }
          });
        }
      }

      // Auto-provision and enrich wallets with university allocations
      const assignedLabIds = new Set(courseAllocations.map(ca => ca.labId));

      const walletTenantKey = tenantId || 'DEFAULT';

      for (const ca of courseAllocations) {
        const cleanLabId = ca.labId;
        const practicalCredit = Number(ca.allocatedTokens || 60);

        let group = groupedWallets.get(cleanLabId);
        if (!group) {
          group = {
            id: `uni-${cleanLabId}`,
            labId: cleanLabId,
            rows: [],
            maxRowTotal: 0,
            usedTokens: 0,
            allocation: 0,
            updatedAt: new Date().toISOString()
          };
          groupedWallets.set(cleanLabId, group);
        }
        group.allocation = Math.max(group.allocation || 0, practicalCredit);
        if (!group.labTitle || group.labTitle === `${cleanLabId.toUpperCase()} Lab`) {
          group.labTitle = ca.labTitle;
        }

        // Make sure the allocation row holds whatever part of the entitlement the student's other
        // wallet rows for this lab do not already cover. Raise-only, so purchases are never folded in twice.
        const isAllocationRow = (r) =>
          String(r.TenantId) === String(walletTenantKey) &&
          String(r.StudentId) === String(studentId) &&
          String(r.LabId).toLowerCase() === cleanLabId;
        const otherRowsTotal = group.rows
          .filter((r) => !isAllocationRow(r))
          .reduce((sum, r) => sum + Number(r.TotalPurchasedTokens || 0), 0);
        const allocationRowTarget = Math.max(0, entitlementFor(group) - otherRowsTotal);

        try {
          if (allocationRowTarget > 0) {
            await pool.query(
              `INSERT INTO student_lab_token_wallets (TenantId, StudentId, LabId, TotalPurchasedTokens, ConsumedTokens, RemainingTokens, Version)
               VALUES (?, ?, ?, ?, 0, ?, 1)
               ON DUPLICATE KEY UPDATE
                 TotalPurchasedTokens = IF(TotalPurchasedTokens < VALUES(TotalPurchasedTokens), VALUES(TotalPurchasedTokens), TotalPurchasedTokens),
                 RemainingTokens = CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED) THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END`,
              [walletTenantKey, String(studentId), cleanLabId, allocationRowTarget, allocationRowTarget]
            );
          }

          // Record ALLOCATION ledger entry idempotently
          const allocKey = `ALLOC-SSO-${studentId}-${cleanLabId}`;
          await pool.query(
            `INSERT INTO student_lab_token_transactions
              (TenantId, StudentId, LabId, WalletId, TransactionType, Tokens, TokenChange, BalanceBefore, BalanceAfter, ReferenceType, ReferenceId, Description, IdempotencyKey)
             VALUES (?, ?, ?, 0, 'ALLOCATION', ?, ?, 0, ?, 'CURRICULUM_QUOTA', ?, ?, ?)
             ON DUPLICATE KEY UPDATE Id=Id`,
            [
              tenantId || 'DEFAULT',
              String(studentId),
              cleanLabId,
              practicalCredit,
              practicalCredit,
              practicalCredit,
              ca.courseCode || 'CURRICULUM_QUOTA',
              `University Course Allocation: ${ca.labTitle || cleanLabId} (${practicalCredit} Tokens)`,
              allocKey
            ]
          ).catch(() => {});

          const creditAllocKey = `ALLOC-CREDIT-${studentId}-${cleanLabId}`;
          const [uRows] = await pool.query("SELECT UserId FROM Users WHERE LOWER(Email) = LOWER(?) OR CAST(UserId AS CHAR) = ? LIMIT 1", [auth?.email || '', String(studentId)]).catch(() => [[]]);
          const effectiveUserId = uRows?.[0]?.UserId || Number(studentId) || 1;
          await pool.query(
            `INSERT INTO credit_transactions
              (TenantId, UserId, Type, Source, Credits, Amount, Currency, PaymentReference, LabId, IdempotencyKey, Status, MetadataJson)
             VALUES (?, ?, 'ALLOCATION', 'UNIVERSITY_ALLOCATION', ?, 0.00, 'INR', ?, ?, ?, 'SUCCESS', ?)
             ON DUPLICATE KEY UPDATE TransactionId=TransactionId`,
            [
              tenantId || 'DEFAULT',
              effectiveUserId,
              practicalCredit,
              ca.courseCode || 'CURRICULUM_QUOTA',
              cleanLabId,
              creditAllocKey,
              JSON.stringify({ labTitle: ca.labTitle, courseCode: ca.courseCode, allocationType: 'UNIVERSITY' })
            ]
          ).catch(() => {});
        } catch (e) {}
      }

      // Check if student has purchased non-assigned labs via credit_transactions or student_lab_token_transactions
      const [creditPurchases] = await pool.query(
        `SELECT DISTINCT LabId FROM credit_transactions 
         WHERE (UserId = ? OR UserId = ? OR UserId IN (SELECT UserId FROM Users WHERE LOWER(Email) = LOWER(?) OR CAST(UserId AS CHAR) = ?)) AND Status = 'SUCCESS' AND Type = 'PURCHASE'`,
        [String(studentId), auth?.email || '', auth?.email || '', String(studentId)]
      ).catch(() => [[]]);

      const [tokenPurchases] = await pool.query(
        `SELECT DISTINCT LabId FROM student_lab_token_transactions 
         WHERE (StudentId = ? OR StudentId = ? OR StudentId IN (SELECT CAST(UserId AS CHAR) FROM Users WHERE LOWER(Email) = LOWER(?) OR CAST(UserId AS CHAR) = ?)) AND TransactionType = 'PURCHASE'`,
        [String(studentId), auth?.email || '', auth?.email || '', String(studentId)]
      ).catch(() => [[]]);

      const purchasedLabIds = new Set();
      for (const p of [...(creditPurchases || []), ...(tokenPurchases || [])]) {
        const raw = String(p.LabId || "").toLowerCase().trim();
        const clean = raw.replace(/^lab-/, "").replace(/-lab$/, "");
        const canonical = purchaseAliases.get(raw) || purchaseAliases.get(clean) || toCleanLabId(raw);
        if (canonical) purchasedLabIds.add(canonical);
        if (clean) purchasedLabIds.add(clean);
      }

      // For university students, filter out any wallet that is neither assigned by university nor purchased.
      // Only safe once allocations actually resolved; an LMS outage must never hide or delete wallets.
      for (const [key] of (courseAllocations.length > 0 ? groupedWallets.entries() : [])) {
        const cleanKey = key.toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
        const isAssigned = assignedLabIds.has(cleanKey);
        const isPurchased = purchasedLabIds.has(cleanKey) || (purchasedByLab.get(cleanKey) || 0) > 0;
        if (!isAssigned && !isPurchased) {
          groupedWallets.delete(key);
          // Also clean up zero-consumed orphan row from database so it never returns
          try {
            await pool.query(
              `DELETE FROM student_lab_token_wallets 
               WHERE (StudentId = ? OR StudentId = ?) 
                 AND (LOWER(LabId) = ? OR LOWER(LabId) = ? OR LOWER(REPLACE(REPLACE(LabId, 'lab-', ''), '-lab', '')) = ?) 
                 AND ConsumedTokens = 0
                 AND TotalPurchasedTokens = 0`,
              [String(studentId), auth?.email || '', cleanKey, `lab-${cleanKey}`, cleanKey]
            );
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn("[studentLabTokensSummaryHandler] LMS enrichment skipped:", err.message);
  }

  const labWallets = Array.from(groupedWallets.values()).map((group) => {
    const entitled = entitlementFor(group);
    const remaining = Math.max(0, entitled - group.usedTokens);
    return {
      id: group.id,
      labId: group.labId,
      ...(group.labTitle ? { labTitle: group.labTitle } : {}),
      purchasedTokens: entitled,
      allocatedTokens: group.allocation || entitled,
      extraPurchasedTokens: purchasedByLab.get(group.labId) || 0,
      usedTokens: group.usedTokens,
      remainingTokens: remaining,
      runtimeRemainingMinutes: remaining,
      updatedAt: group.updatedAt
    };
  });
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

  // Synchronize credit_wallets total balance for the student
  try {
    const [uRows] = await pool.query("SELECT UserId FROM Users WHERE LOWER(Email) = LOWER(?) OR CAST(UserId AS CHAR) = ? LIMIT 1", [auth?.email || '', String(studentId)]).catch(() => [[]]);
    const effUserId = uRows?.[0]?.UserId || Number(studentId);
    if (effUserId && !isNaN(effUserId)) {
      await pool.query(
        `INSERT INTO credit_wallets (TenantId, UserId, Balance, TotalPurchasedCredits, ConsumedCredits, Status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE
           Balance = VALUES(Balance),
           TotalPurchasedCredits = VALUES(TotalPurchasedCredits),
           ConsumedCredits = VALUES(ConsumedCredits)`,
        [tenantId || 'DEFAULT', effUserId, totalRemaining, totalPurchased, totalUsed]
      );
    }
  } catch (e) {}

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
    const clean = String(labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
    const defaultTokens = clean.includes('dbms') ? 90 : (clean.includes('dotnet') ? 80 : 60);
    purchasedTokens = defaultTokens;
    remainingTokens = defaultTokens;
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
