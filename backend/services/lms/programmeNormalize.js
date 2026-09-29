export function normalizeProgramme(raw) {
  if (!raw || typeof raw !== "object") return null;
  const programmeName = raw.programmeName || raw.programName || raw.programmeNameAndCode || raw.name || null;
  const programmeId = raw.programmeId ?? raw.programId ?? null;
  const currentSemester = raw.currentSemester ?? raw.semesterNumber ?? null;
  return {
    ...raw,
    programmeName,
    programName: raw.programName || programmeName,
    programmeCode: raw.programmeCode || raw.programCode || null,
    programmeId,
    programId: raw.programId ?? raw.programmeId ?? null,
    currentSemester,
    totalSemesters: raw.totalSemesters ?? null,
    enrollmentNumber: raw.enrollmentNumber || raw.enrollmentnumber || null,
    admissionDate: raw.admissionDate || null,
    status: raw.status || raw.programmeStatus || null,
  };
}

function semesterKey(semester) {
  if (semester == null) return "";
  if (typeof semester !== "object") return String(semester);
  return String(semester.semesterNumber ?? semester.semesterId ?? "");
}

export function dedupeSemesters(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const key = semesterKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (typeof item === "object") {
      out.push({
        ...item,
        semesterNumber: item.semesterNumber ?? item.semesterId ?? null,
        semesterId: item.semesterId ?? item.semesterNumber ?? null,
      });
    } else {
      out.push({ semesterNumber: item, semesterId: item });
    }
  }
  return out;
}

export function mergeProgrammes(profileList, purchasedPayload) {
  const purchased = purchasedPayload?.programmeList || purchasedPayload?.programList || [];
  const sharedSemesters = purchasedPayload?.semesterList || [];
  const mergedList = [];

  // First process purchased list (which has authoritative programmeId)
  for (const raw of purchased) {
    const programme = normalizeProgramme(raw);
    if (!programme || !programme.programmeName) continue;
    mergedList.push(programme);
  }

  // Then merge in profile list items
  for (const raw of (profileList || [])) {
    const p = normalizeProgramme(raw);
    if (!p || !p.programmeName) continue;

    const existing = mergedList.find(m => 
      (m.programmeId != null && p.programmeId != null && String(m.programmeId) === String(p.programmeId)) ||
      (m.programmeName && p.programmeName && m.programmeName.toLowerCase().trim() === p.programmeName.toLowerCase().trim())
    );

    if (existing) {
      existing.currentSemester = existing.currentSemester || p.currentSemester;
      existing.enrollmentNumber = existing.enrollmentNumber || p.enrollmentNumber;
      existing.admissionDate = existing.admissionDate || p.admissionDate;
      existing.totalSemesters = existing.totalSemesters || p.totalSemesters;
      existing.semesters = dedupeSemesters([...(existing.semesters || []), ...(p.semesters || [])]);
    } else {
      mergedList.push(p);
    }
  }

  // Attach shared semesters
  for (const programme of mergedList) {
    const pid = programme.programmeId != null ? String(programme.programmeId) : "";
    const related = sharedSemesters.filter((semester) => {
      const owner = semester?.programId ?? semester?.programmeId;
      return !pid || owner == null || String(owner) === pid;
    });
    programme.semesters = dedupeSemesters([...(programme.semesters || []), ...related]);
    if (!programme.semesters.length && programme.currentSemester != null && programme.currentSemester !== "") {
      programme.semesters = [{ semesterNumber: programme.currentSemester, semesterId: programme.currentSemester }];
    }
  }

  return mergedList;
}

export function programmeMatches(programme, requested) {
  const wanted = String(requested ?? "").trim().toLowerCase();
  if (!wanted || !programme) return false;
  const exact = [
    programme.programmeId,
    programme.programId,
    programme.programmeCode,
    programme.programCode,
  ]
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value).trim().toLowerCase());
  if (exact.includes(wanted)) return true;
  const name = String(programme.programmeName || programme.programName || "").trim().toLowerCase();
  if (!name) return false;
  if (name === wanted) return true;
  if (wanted.length < 2) return false;
  return name === wanted || name.split(/[^a-z0-9]+/).includes(wanted);
}

export function collectSemesterNumbers(...sources) {
  const set = new Set();
  for (const source of sources) {
    const list = Array.isArray(source) ? source : [];
    for (const item of list) {
      const value = item != null && typeof item === "object"
        ? (item.semesterNumber ?? item.semesterId ?? item.semester)
        : item;
      if (value != null && String(value).trim() !== "") set.add(String(value).trim());
    }
  }
  return set;
}

export function filterSemesterPayload(payload, semester) {
  const semesterList = payload?.semesterList || payload?.semesterCourseList || [];
  const flatCourses = payload?.courseList || payload?.courselist || payload?.courses || [];

  if (semester == null || semester === "") {
    const nested = [];
    for (const item of semesterList) {
      nested.push(...(item?.courseList || item?.courselist || []));
    }
    return {
      semesterList,
      courseList: flatCourses.length ? flatCourses : nested,
    };
  }

  const wanted = String(semester);
  const matchedSemesters = semesterList.filter((item) =>
    String(item?.semesterNumber ?? "") === wanted || String(item?.semesterId ?? "") === wanted
  );

  const nestedCourses = [];
  for (const item of matchedSemesters) {
    nestedCourses.push(...(item?.courseList || item?.courselist || []));
  }

  const flatMatches = flatCourses.filter((course) => {
    const number = String(course?.semesterNumber ?? course?.semester ?? "");
    const id = String(course?.semesterId ?? "");
    return number === wanted || id === wanted;
  });

  return {
    semesterList: matchedSemesters,
    courseList: flatMatches.length ? flatMatches : nestedCourses,
  };
}
