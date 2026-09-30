import { executeRequest } from './GetApiHandler';
import { BASE_URL } from './Api_path';

export const LMS_BASE_URL = BASE_URL;

export const LMS_API_PATHS = {
  STUDENT: {
    REFRESH_PROFILE: '/student/refresh-profile',
    GET_PROFILE: '/student/profile',
    PURCHASED_PROGRAMMES: '/student/purchased-programmes',
    PROGRAMME_SEMESTERS: '/student/programme-semesters',
    PRACTICAL_AVAILABLE_PROGRAMS: '/student/practical-available-programs',
  },
  AUTH: {
    SSO_LOGIN: '/auth/sso-login',
  },
};

// LMS API Handler Functions

export const refreshStudentProfile = async () => {
  return executeRequest(LMS_API_PATHS.STUDENT.REFRESH_PROFILE, {
    method: 'POST',
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

export const getStudentProfile = async (studentId) => {
  return executeRequest(LMS_API_PATHS.STUDENT.GET_PROFILE, {
    method: 'GET',
    auth: true,
    baseUrl: LMS_BASE_URL,
    params: studentId ? { studentId } : undefined,
  });
};

export const getStudentPurchasedProgrammes = async (studentId) => {
  const body = studentId ? { studentId } : {};
  return executeRequest(LMS_API_PATHS.STUDENT.PURCHASED_PROGRAMMES, {
    method: 'POST',
    body,
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

export const getSemesterLabs = async (programId, semester) => {
  return executeRequest('/student/semester-labs', {
    method: 'GET',
    auth: true,
    baseUrl: LMS_BASE_URL,
    params: { programId, semester },
  });
};

export const getSemesterCourseListByProgrammeId = async (programmeId, semester) => {
  return executeRequest(LMS_API_PATHS.STUDENT.PROGRAMME_SEMESTERS, {
    method: 'POST',
    body: { programmeId, ...(semester ? { semester } : {}) },
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

export const getStudentAcademicProgress = async (studentId) => {
  return executeRequest('/student/academic-progress', {
    method: 'GET',
    auth: true,
    baseUrl: LMS_BASE_URL,
    params: studentId ? { studentId } : undefined,
  });
};

function firstFilled(...values) {
  for (const value of values) {
    if (value != null && value !== '') return value;
  }
  return null;
}

function isUniversityAccount(user) {
  if (!user) return false;
  const auth = String(user.authType || '').toUpperCase();
  const created = String(user.createdFrom || '').toUpperCase();
  return auth === 'LMS' || auth === 'LMS_AND_DIRECT' || created === 'LMS' || user.isLmsStudent === true || Boolean(user.studentDegreeAdmissionId) || Boolean(user.externalStudentId) || Boolean(user.studentId);
}

/**
 * After SSO, load the Experia profile, purchased programmes (by student id),
 * and academic progress, then merge them into the signed-in user.
 */
export async function loadStudentPortalData(studentId) {
  const profile = await getStudentProfile(studentId);
  const apiUser = profile?.user || {};
  const resolvedId = firstFilled(
    studentId,
    apiUser.studentId,
    profile?.lmsIdentity?.studentId,
    apiUser.studentDegreeAdmissionId,
    apiUser.externalStudentId,
  );

  let programmes = null;
  let progress = null;
  if (isUniversityAccount(apiUser) || resolvedId) {
    const [programmesResult, progressResult] = await Promise.allSettled([
      getStudentPurchasedProgrammes(resolvedId),
      getStudentAcademicProgress(resolvedId),
    ]);
    programmes = programmesResult.status === 'fulfilled' ? programmesResult.value : null;
    progress = progressResult.status === 'fulfilled' ? progressResult.value : null;
  }

  return { profile, programmes, progress };
}

export function mergeStudentPortalUser(currentUser, payload) {
  const profileRes = payload?.profile || {};
  const apiUser = profileRes.user || {};
  const profile = profileRes.profile || {};
  const purchased = payload?.programmes || {};
  const progress = payload?.progress || {};
  const purchasedList = purchased.programmeList || purchased.programList || [];
  const progressList = progress.programmes || [];
  const profileList = (apiUser.programmesList && apiUser.programmesList.length)
    ? apiUser.programmesList
    : (profileRes.programmes || []);
  const programmes = purchasedList.length
    ? purchasedList
    : (progressList.length ? progressList : (profileList.length ? profileList : (currentUser?.programmesList || [])));
  const primary = programmes[0] || {};
  const academicProgress = {
    ...(currentUser?.academicProgress || {}),
    ...(progress.academicProgress || {}),
  };
  const live = purchasedList.length > 0
    || progressList.length > 0
    || profileList.length > 0
    || profileRes.profileStatus === 'LIVE'
    || purchased.lmsStatus === 'LIVE'
    || progress.progressStatus === 'LIVE';

  return {
    ...(currentUser || {}),
    ...apiUser,
    userId: apiUser.userId || apiUser.id || currentUser?.userId,
    fullName: firstFilled(profile.fullName, apiUser.fullName, currentUser?.fullName),
    name: firstFilled(profile.fullName, apiUser.name, apiUser.fullName, currentUser?.name),
    email: firstFilled(profile.email, apiUser.email, currentUser?.email),
    mobile: firstFilled(profile.mobile, apiUser.mobile, currentUser?.mobile),
    alternateMobile: firstFilled(profile.alternateMobile, apiUser.alternateMobile, currentUser?.alternateMobile),
    gender: firstFilled(profile.gender, apiUser.gender, currentUser?.gender),
    dateOfBirth: firstFilled(profile.dateOfBirth, apiUser.dateOfBirth, currentUser?.dateOfBirth),
    address: firstFilled(profile.address, apiUser.address, currentUser?.address),
    profileImage: firstFilled(profile.profileImage, apiUser.profileImage, currentUser?.profileImage),
    studentId: firstFilled(apiUser.studentId, profileRes.lmsIdentity?.studentId, currentUser?.studentId),
    studentDegreeAdmissionId: firstFilled(apiUser.studentDegreeAdmissionId, currentUser?.studentDegreeAdmissionId),
    programmesList: programmes,
    programName: firstFilled(primary.programmeName, primary.programName, apiUser.programName, currentUser?.programName),
    currentSemester: firstFilled(primary.currentSemester, apiUser.currentSemester, currentUser?.currentSemester),
    enrollmentNumber: firstFilled(primary.enrollmentNumber, apiUser.enrollmentNumber, currentUser?.enrollmentNumber),
    collegeName: firstFilled(apiUser.collegeName, profileRes.tenant?.name, currentUser?.collegeName),
    tenantName: firstFilled(apiUser.tenantName, profileRes.tenant?.name, currentUser?.tenantName),
    profileStatus: live ? 'LIVE' : firstFilled(profileRes.profileStatus, progress.progressStatus, purchased.lmsStatus, currentUser?.profileStatus),
    academicProgress,
    createdFrom: apiUser.createdFrom || currentUser?.createdFrom,
    authType: apiUser.authType || currentUser?.authType,
    isLmsStudent: apiUser.isLmsStudent ?? currentUser?.isLmsStudent,
    hasPassword: apiUser.hasPassword ?? profileRes.identity?.hasPassword ?? currentUser?.hasPassword,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
}

export const getPracticalAvailablePrograms = async () => {
  return executeRequest(LMS_API_PATHS.STUDENT.PRACTICAL_AVAILABLE_PROGRAMS, {
    method: 'POST',
    body: {},
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

