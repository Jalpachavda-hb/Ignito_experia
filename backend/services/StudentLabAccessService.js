/**
 * Unified student lab access: university-assigned labs ∪ student-purchased labs.
 *
 * Sources (existing data only, no new assignment mechanism):
 *   - university: the student's LMS programmes -> course catalogue -> course codes ->
 *                 course_lab_mappings (tenant_id = student's TenantId or 'PLATFORM', status
 *                 'active'). Only real mapping rows count; nothing is guessed.
 *   - purchased:  student_lab_token_transactions rows of type PURCHASE for this student.
 *   - granted:    a student_lab_token_wallets row with no purchase and no current course
 *                 mapping (e.g. tokens provisioned at SSO or by an admin). The student holds
 *                 tokens for the lab, so it stays usable and is labelled honestly.
 * Catalog:        ignito_experia_owner.labs. Deleted labs never appear; inactive labs appear
 *                 only when the student already has access, marked inactive and not launchable.
 *
 * One entry per lab (keyed by the canonical lab key: LabCode without "lab-"/"-lab"), with the
 * set of sources kept internally and exposed as accessSource university|purchased|both|granted.
 */
import pool from "../lib/mysql.js";
import { loadStudentLmsContext, loadOwnedProgrammes } from "./lms/studentLmsContext.js";
import { lmsCourseService } from "./lms/LmsCourseService.js";
import { collectSemesterNumbers } from "./lms/programmeNormalize.js";
import { lmsResponseCache } from "./lms/LmsResponseCache.js";
import { resolveLabAlias } from "../lib/labAliases.js";

const ACCESS_TTL_SECONDS = Number(process.env.LAB_ACCESS_CACHE_TTL_SECONDS || 60);
const CATALOG_TTL_MS = Number(process.env.LAB_CATALOG_CACHE_TTL_MS || 30000);

export const canonicalLabKey = (value) =>
  String(value || "").toLowerCase().trim().replace(/^lab-/, "").replace(/-lab$/, "");

/** Every key a lab can be referred to by (code, canonical, legacy alias target). */
function labKeys(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (!raw) return [];
  const keys = new Set([raw, canonicalLabKey(raw)]);
  const alias = String(resolveLabAlias(raw) || "").toLowerCase();
  if (alias) { keys.add(alias); keys.add(canonicalLabKey(alias)); }
  return [...keys];
}

const accessCacheKey = (userId) => `labaccess:v1:${String(userId)}`;

export async function invalidateStudentLabAccess(userId) {
  if (userId == null) return;
  await lmsResponseCache.invalidate(accessCacheKey(userId)).catch(() => {});
}

// ---------- catalog (global, not user-specific: safe to share between students) ----------
let catalogCache = { at: 0, rows: null, pending: null };

export async function loadLabCatalog({ db = pool, force = false } = {}) {
  const now = Date.now();
  if (!force && catalogCache.rows && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.rows;
  if (catalogCache.pending) return catalogCache.pending;
  catalogCache.pending = (async () => {
    const [rows] = await db.query(
      `SELECT \`LabId\`, \`LabCode\`, \`Title\`, \`Subtitle\`, \`Semester\`, \`Logo\`, \`BaseTokenPrice\`, \`Complexity\`,
              \`Category\`, \`Description\`, \`RuntimeType\`, \`DisplayOrder\`, \`Status\`, \`IsDeleted\`
       FROM \`ignito_experia_owner\`.\`labs\`
       WHERE \`IsDeleted\` = 0`
    );
    catalogCache = { at: Date.now(), rows, pending: null };
    return rows;
  })().catch((err) => {
    catalogCache.pending = null;
    throw err;
  });
  return catalogCache.pending;
}

export function resetLabCatalogCache() {
  catalogCache = { at: 0, rows: null, pending: null };
}

/** Catalog row for a lab code / id / legacy alias, or null. */
export function findCatalogLab(rows, labRef) {
  const byKey = indexCatalog(rows || []);
  for (const key of [...labKeys(labRef), String(labRef || "")]) {
    const lab = byKey.get(key);
    if (lab) return lab;
  }
  return null;
}

function indexCatalog(rows) {
  const byKey = new Map();
  for (const lab of rows) {
    for (const key of [...labKeys(lab.LabCode), String(lab.LabId)]) {
      if (!byKey.has(key)) byKey.set(key, lab);
    }
  }
  return byKey;
}

// ---------- university source ----------
async function universityCourseCodes(ctx) {
  if (!ctx?.universityStudent || !ctx?.tenant) return { codes: [], lmsStatus: null };
  const owned = await loadOwnedProgrammes(ctx);
  const programmes = owned.programmes || [];
  if (!programmes.length) return { codes: [], lmsStatus: owned.lmsStatus || "LMS_NO_PROGRAMMES" };

  // Programme catalogues in parallel (each is cached by LmsResponseCache).
  const results = await Promise.allSettled(
    programmes.map((programme) =>
      lmsCourseService.getByProgramme({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        programmeId: programme.programmeId ?? programme.programId,
        semester: null,
        externalStudentId: ctx.externalStudentId,
      }).then((catalogue) => ({ programme, catalogue }))
    )
  );

  const codes = new Set();
  let anyLive = false;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { programme, catalogue } = r.value;
    if (catalogue?.lmsStatus !== "LIVE") continue;
    anyLive = true;
    const allowed = collectSemesterNumbers(
      catalogue.semesterList,
      programme?.semesters
    );
    for (const course of catalogue.courseList || []) {
      const sem = course?.semesterNumber ?? course?.semesterId ?? course?.semester;
      if (allowed.size && sem != null && sem !== "" && !allowed.has(String(sem))) continue;
      const code = String(course?.courseCode || course?.code || course?.subjectCode || "").trim();
      if (code) codes.add(code);
    }
  }
  return { codes: [...codes], lmsStatus: anyLive ? "LIVE" : (owned.lmsStatus || "LMS_COURSES_UNAVAILABLE") };
}

async function universityMappings(db, tenantId, codes) {
  if (!tenantId || !codes.length) return [];
  const [rows] = await db.query(
    `SELECT lab_id, course_code, practical_credit, tenant_id
     FROM course_lab_mappings
     WHERE (tenant_id = ? OR tenant_id = 'PLATFORM')
       AND status = 'active'
       AND course_code IN (${codes.map(() => "?").join(",")})
     ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END, id DESC`,
    [tenantId, ...codes, tenantId]
  );
  return rows;
}

// ---------- wallet / purchase source ----------
async function walletsAndPurchases(db, userId, email) {
  const sid = String(userId);
  const [wallets] = await db.query(
    `SELECT LabId, TotalPurchasedTokens, ConsumedTokens,
            CASE WHEN CAST(TotalPurchasedTokens AS SIGNED) >= CAST(ConsumedTokens AS SIGNED)
                 THEN CAST(TotalPurchasedTokens AS SIGNED) - CAST(ConsumedTokens AS SIGNED) ELSE 0 END AS RemainingTokens
     FROM student_lab_token_wallets
     WHERE StudentId = ? OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?))`,
    [sid, email || null, email || null]
  );
  const [purchases] = await db.query(
    `SELECT DISTINCT LabId
     FROM student_lab_token_transactions
     WHERE (StudentId = ? OR (? IS NOT NULL AND LOWER(StudentId) = LOWER(?)))
       AND TransactionType = 'PURCHASE'`,
    [sid, email || null, email || null]
  );
  return { wallets, purchases };
}

/**
 * Pure merge step (exported for tests).
 * @returns {Array<object>} one entry per catalog lab the student may access
 */
export function mergeLabAccess({ catalog, universityRows = [], wallets = [], purchases = [] }) {
  const byKey = indexCatalog(catalog);
  const entries = new Map(); // catalog LabId -> entry

  const entryFor = (labRef) => {
    let lab = null;
    for (const key of labKeys(labRef)) {
      lab = byKey.get(key);
      if (lab) break;
    }
    if (!lab) return null; // deleted or unknown lab: never exposed
    let entry = entries.get(lab.LabId);
    if (!entry) {
      entry = { lab, sources: new Set(), courses: new Set(), practicalCredit: null, remainingTokens: 0, totalTokens: 0, consumedTokens: 0, hasWallet: false };
      entries.set(lab.LabId, entry);
    }
    return entry;
  };

  for (const row of universityRows) {
    const entry = entryFor(row.lab_id);
    if (!entry) continue;
    entry.sources.add("university");
    if (row.course_code) entry.courses.add(String(row.course_code));
    const credit = Number(row.practical_credit);
    if (Number.isFinite(credit) && credit > 0) entry.practicalCredit = Math.max(entry.practicalCredit || 0, credit);
  }
  for (const row of purchases) {
    const entry = entryFor(row.LabId);
    if (entry) entry.sources.add("purchased");
  }
  for (const w of wallets) {
    const entry = entryFor(w.LabId);
    if (!entry) continue;
    entry.hasWallet = true;
    // Several legacy rows can exist for one lab (e.g. "java" and "java-lab"); add them up.
    entry.remainingTokens += Math.max(0, Number(w.RemainingTokens) || 0);
    entry.totalTokens += Number(w.TotalPurchasedTokens) || 0;
    entry.consumedTokens += Number(w.ConsumedTokens) || 0;
  }

  const result = [];
  for (const entry of entries.values()) {
    if (!entry.sources.size && entry.hasWallet) entry.sources.add("granted");
    if (!entry.sources.size) continue;
    const { lab } = entry;
    const active = String(lab.Status || "").toLowerCase() === "active";
    const university = entry.sources.has("university");
    const purchased = entry.sources.has("purchased");
    const accessSource = university && purchased ? "both" : university ? "university" : purchased ? "purchased" : "granted";
    const hasTokens = entry.remainingTokens > 0;
    result.push({
      id: lab.LabCode,
      labId: lab.LabCode,
      dbId: lab.LabId,
      labCode: lab.LabCode,
      title: lab.Title || lab.LabCode,
      subtitle: lab.Subtitle || "",
      semester: lab.Semester || "",
      logo: lab.Logo || "",
      category: lab.Category || "",
      complexity: lab.Complexity || "",
      description: lab.Description || "",
      runtimeType: lab.RuntimeType || "",
      baseTokenPrice: lab.BaseTokenPrice != null ? Number(lab.BaseTokenPrice) : null,
      displayOrder: Number(lab.DisplayOrder) || 0,
      status: active ? "active" : "inactive",
      access: {
        accessSource,
        sources: [...entry.sources].sort(),
        viaUniversity: university,
        viaPurchase: purchased,
        courses: [...entry.courses].sort(),
        practicalCredit: entry.practicalCredit,
        remainingTokens: entry.remainingTokens,
        totalTokens: entry.totalTokens,
        consumedTokens: entry.consumedTokens,
        hasTokens,
        // A university lab without a wallet yet gets its course credit on first start.
        canLaunch: active && (hasTokens || (university && !entry.hasWallet)),
        needsTokens: active && !hasTokens && !(university && !entry.hasWallet),
      },
    });
  }
  result.sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
  return result;
}

class StudentLabAccessService {
  /**
   * @returns {Promise<{ labs: object[], tenantId: string|null, isLmsStudent: boolean, universityStatus: string|null, generatedAt: string, cache: "HIT"|"MISS" }>}
   */
  async getAccess(auth, { forceRefresh = false, db = pool, resolveCourseCodes = universityCourseCodes } = {}) {
    if (!auth?.userId) throw new Error("auth.userId required");
    const key = accessCacheKey(auth.userId);
    if (!forceRefresh) {
      const cached = await lmsResponseCache.read(key).catch(() => null);
      if (cached) return { ...cached, cache: "HIT" };
    }

    const ctx = await loadStudentLmsContext(auth);
    const userId = ctx.profile?.UserId ?? auth.userId;
    const email = ctx.profile?.Email || auth.email || null;
    const tenantId = ctx.tenant?.TenantId || null;

    const [catalog, uni, owned] = await Promise.all([
      loadLabCatalog({ db }),
      resolveCourseCodes(ctx).catch((err) => {
        console.warn("[StudentLabAccess] LMS courses unavailable:", err.message);
        return { codes: [], lmsStatus: "LMS_COURSES_UNAVAILABLE" };
      }),
      walletsAndPurchases(db, userId, email),
    ]);
    const universityRows = await universityMappings(db, tenantId, uni.codes);

    const labs = mergeLabAccess({ catalog, universityRows, wallets: owned.wallets, purchases: owned.purchases });
    const payload = {
      labs,
      tenantId,
      isLmsStudent: Boolean(ctx.universityStudent),
      // LIVE, or why university labs could not be confirmed (purchased/granted labs still listed).
      universityStatus: ctx.universityStudent ? uni.lmsStatus : null,
      generatedAt: new Date().toISOString(),
    };
    // Only cache a complete answer; an LMS outage should not pin a partial list for a minute.
    if (!ctx.universityStudent || uni.lmsStatus === "LIVE") {
      await lmsResponseCache.write(key, payload, ACCESS_TTL_SECONDS).catch(() => {});
    }
    return { ...payload, cache: "MISS" };
  }

  /** Access entry for one lab, or null when the student has no access. */
  async getLabAccess(auth, labRef, opts = {}) {
    const { labs } = await this.getAccess(auth, opts);
    const wanted = new Set(labKeys(labRef));
    return labs.find((l) => labKeys(l.labCode).some((k) => wanted.has(k)) || wanted.has(String(l.dbId))) || null;
  }
}

export const studentLabAccessService = new StudentLabAccessService();
export default studentLabAccessService;
