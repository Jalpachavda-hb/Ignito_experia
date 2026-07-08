/**
 * API response helpers — mirrors backend/lib/apigw.js pattern
 */

export const ok = (body, statusCode = 200) => ({ statusCode, body });
export const created = (body) => ({ statusCode: 201, body });
export const notFound = (message = "Not found") => ({
  statusCode: 404,
  body: { success: false, message },
});
export const badRequest = (message = "Bad request") => ({
  statusCode: 400,
  body: { success: false, message },
});
export const unauthorized = (message = "Unauthorized") => ({
  statusCode: 401,
  body: { success: false, message },
});
export const forbidden = (message = "Forbidden") => ({
  statusCode: 403,
  body: { success: false, message },
});
export const serverError = (body) => ({
  statusCode: 500,
  body: body || { success: false, message: "Internal server error" },
});
