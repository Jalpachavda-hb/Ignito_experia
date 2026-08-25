import { ok } from "../lib/apigw.js";
import { badRequest, forbidden, unauthorized, notFound } from "../lib/errors.js";
import labTokenPackageRepository from "../repositories/LabTokenPackageRepository.js";

export const ownerCreatePackageHandler = async ({ body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  if (auth.role !== "OWNER" && auth.role !== "Super Admin") {
    throw forbidden("Only Owner platform role can create token pricing packages");
  }

  const { labId, tokenAmount, priceAmount, currency = "INR", isActive = true } = body || {};
  if (!labId) throw badRequest("labId is required");
  if (!tokenAmount || Number(tokenAmount) <= 0) throw badRequest("tokenAmount must be > 0");
  if (priceAmount === undefined || Number(priceAmount) < 0) throw badRequest("priceAmount must be >= 0");

  const pkgId = await labTokenPackageRepository.createPackage({
    labId,
    tokenAmount: Number(tokenAmount),
    priceAmount: Number(priceAmount),
    currency,
    isActive: Boolean(isActive),
    createdBy: auth.userId
  });

  const createdPkg = await labTokenPackageRepository.getPackageById(pkgId);
  return ok({
    success: true,
    message: "Lab token package created successfully",
    package: createdPkg
  });
};

export const ownerListPackagesHandler = async () => {
  const packages = await labTokenPackageRepository.getAllPackages();
  return ok({ packages });
};

export const ownerUpdatePackageHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  if (auth.role !== "OWNER" && auth.role !== "Super Admin") {
    throw forbidden("Only Owner platform role can modify token pricing packages");
  }

  const id = pathParameters?.id;
  if (!id) throw badRequest("package ID is required");

  const existing = await labTokenPackageRepository.getPackageById(id);
  if (!existing) throw notFound("Package not found");

  const updated = await labTokenPackageRepository.updatePackage(id, {
    priceAmount: body?.priceAmount !== undefined ? Number(body.priceAmount) : undefined,
    tokenAmount: body?.tokenAmount !== undefined ? Number(body.tokenAmount) : undefined,
    isActive: body?.isActive !== undefined ? Boolean(body.isActive) : undefined
  });

  return ok({
    success: true,
    message: "Lab token package updated successfully",
    package: updated
  });
};

export const ownerSetPackageStatusHandler = async ({ pathParameters, body, auth }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  if (auth.role !== "OWNER" && auth.role !== "Super Admin") {
    throw forbidden("Only Owner platform role can change package status");
  }

  const id = pathParameters?.id;
  const isActive = body?.isActive !== undefined ? Boolean(body.isActive) : true;

  const updated = await labTokenPackageRepository.setPackageStatus(id, isActive);
  return ok({
    success: true,
    message: `Package ${isActive ? 'activated' : 'deactivated'} successfully`,
    package: updated
  });
};
