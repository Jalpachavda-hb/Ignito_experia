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

export const getStudentProfile = async () => {
  return executeRequest(LMS_API_PATHS.STUDENT.GET_PROFILE, {
    method: 'GET',
    auth: true,
    baseUrl: LMS_BASE_URL,
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

export const getStudentAcademicProgress = async () => {
  return executeRequest('/student/academic-progress', {
    method: 'GET',
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

export const getPracticalAvailablePrograms = async () => {
  return executeRequest(LMS_API_PATHS.STUDENT.PRACTICAL_AVAILABLE_PROGRAMS, {
    method: 'POST',
    body: {},
    auth: true,
    baseUrl: LMS_BASE_URL,
  });
};

