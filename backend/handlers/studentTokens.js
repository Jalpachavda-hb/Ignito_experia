import { ok } from "../lib/apigw.js";
import { unauthorized, notFound } from "../lib/errors.js";
import studentLabTokenWalletRepository from "../repositories/StudentLabTokenWalletRepository.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";
import labTokenUsageRepository from "../repositories/LabTokenUsageRepository.js";

export const studentLabTokensSummaryHandler = async ({ auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "DIRECT";
  const studentId = auth.userId;

  const wallets = await studentLabTokenWalletRepository.getAllWalletsForStudent(tenantId, studentId);

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
        usedTokens: used,
        remainingTokens: Math.max(0, purchased - used),
        runtimeRemainingMinutes: Math.max(0, purchased - used),
        updatedAt: w.UpdatedAt
      });
    } else {
      const existing = groupedWallets.get(cleanId);
      existing.purchasedTokens += purchased;
      existing.usedTokens += used;
      existing.remainingTokens = Math.max(0, existing.purchasedTokens - existing.usedTokens);
      existing.runtimeRemainingMinutes = existing.remainingTokens;
    }
  });

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
    summary: {
      totalPurchased,
      totalUsed,
      totalRemaining
    },
    labs: labWallets
  });
};

export const studentLabSingleTokenBalanceHandler = async ({ pathParameters, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";
  const labId = pathParameters?.labId;

  const wallet = await studentLabTokenWalletRepository.getWallet(tenantId, auth.userId, labId);
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
  const tenantId = auth.tenantId || auth.universityId || auth.tenant_id || "TEN000001";
  const labId = queryStringParameters?.labId || null;
  const limit = Math.min(100, Math.max(1, Number(queryStringParameters?.limit || 50)));
  const offset = Math.max(0, Number(queryStringParameters?.offset || 0));

  const usageLogs = await labTokenUsageRepository.getStudentLabUsage(tenantId, auth.userId, labId, limit, offset);
  return ok({ usage: usageLogs });
};
