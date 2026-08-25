declare module '*GetApiHandler' {
  export const executeRequest: any;
  export const fetchLabs: any;
  export const fetchSubLabs: any;
  export const fetchLabDetails: any;
  export const fetchLabSessionStatus: any;
  export const fetchJupyterHealth: any;
  export const fetchUserActiveSession: any;
  export const fetchAuthMe: any;
  export const fetchTenantResolve: any;
  export const fetchAdminLabs: any;
  export const fetchRuntimeTypes: any;
  export const fetchUsers: any;
  export const fetchAdminAuditStatistics: any;
  export const fetchAdminAuditLogs: any;
}

declare module '*PostApiHandler' {
  export const loginWithCredentials: (payload: any) => Promise<any>;
  export const registerWithCredentials: (payload: any) => Promise<any>;
  export const logoutUser: () => Promise<any>;
  export const setPassword: (payload: any) => Promise<any>;
  export const changePassword: (payload: any) => Promise<any>;
  export const forgotPassword: (payload: any) => Promise<any>;
  export const resetPassword: (payload: any) => Promise<any>;
  export const startLabSession: (params?: { labId?: string; sessionBlocks?: number; duration?: number; dotnetSubtype?: string; idempotencyKey?: string; userCredits?: number }) => Promise<any>;
  export const extendLabSession: (sessionId?: string, params?: { sessionBlocks?: number; idempotencyKey?: string }) => Promise<any>;
  export const stopLabSession: (sessionId?: string) => Promise<any>;
  export const updateLabCredits: (labId?: string, credits?: number) => Promise<any>;
  export const ssoLogin: (payload?: any, token?: string) => Promise<any>;
  export const updateUserProfile: (payload?: any) => Promise<any>;
  export const uploadProfilePhoto: (formData?: any) => Promise<any>;
  export const mapCourseLab: (courseCode?: string, payload?: any) => Promise<any>;
  export const saveFile: (payload?: any, sessionId?: string) => Promise<any>;
  export const runFile: (payload?: any, sessionId?: string, config?: any) => Promise<any>;
  export const deleteFile: (path?: string, sessionId?: string) => Promise<any>;
  export const startAndroidBuild: (sessionId?: string) => Promise<any>;
  export const updateAdminLabStatus: any;
  export const updateAdminLab: any;
  export const deleteAdminLab: any;
  export const createAdminLab: any;
  export const createUser: any;
  export const updateUser: any;
  export const deleteUser: any;
  export const updateUserCredits: any;
  export const refreshStudentProfile: any;
  export const getStudentProfile: any;
  export const getStudentPurchasedProgrammes: any;
  export const getSemesterCourseListByProgrammeId: any;
  export const getPracticalAvailablePrograms: any;
}

declare module '*lmsApi_paths' {
  export const refreshStudentProfile: any;
  export const getStudentProfile: any;
  export const getStudentPurchasedProgrammes: any;
  export const getSemesterCourseListByProgrammeId: any;
  export const getPracticalAvailablePrograms: any;
}
