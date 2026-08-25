export const LMS_PROVIDER_CONFIG = Object.freeze({
  provider: "GTU_LMS",

  authType: "AUTH0_M2M",

  auth0Domain:
    process.env.LMS_AUTH0_DOMAIN,

  tokenEndpoint:
    process.env.LMS_TOKEN_ENDPOINT,

  audience:
    process.env.LMS_API_AUDIENCE,

  scope:
    process.env.LMS_M2M_SCOPE || process.env.LMS_API_SCOPE,

  grantType:
    process.env.LMS_M2M_GRANT_TYPE ||
    "client_credentials",

  baseUrl:
    process.env.LMS_API_BASE_URL || "https://verse.ignitolearn.com",

  studentProfileEndpoint:
    process.env.LMS_STUDENT_PROFILE_ENDPOINT || "/api/StudentAPI/GetStudentProfile",

  status: "ACTIVE",
});
