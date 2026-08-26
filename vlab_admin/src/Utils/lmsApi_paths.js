import { executeRequest } from './GetApiHandler';
import { BASE_URL } from './Api_path';

const defaultApiPort = import.meta.env.VITE_API_PORT || '8080';

let rawLmsBaseUrl = import.meta.env.VITE_LMS_API_BASE_URL || '';

if (
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  rawLmsBaseUrl.includes('localhost')
) {
  rawLmsBaseUrl = rawLmsBaseUrl.replace('localhost', window.location.hostname);
}

if (typeof window !== 'undefined' && !rawLmsBaseUrl) {
  rawLmsBaseUrl = `${window.location.protocol}//${window.location.hostname}:${defaultApiPort}/api`;
}

export const LMS_BASE_URL = rawLmsBaseUrl
  ? rawLmsBaseUrl.replace(/\/+$/, '')
  : BASE_URL;

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

export const getSemesterCourseListByProgrammeId = async (programmeId) => {
  return executeRequest(LMS_API_PATHS.STUDENT.PROGRAMME_SEMESTERS, {
    method: 'POST',
    body: { programmeId },
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

