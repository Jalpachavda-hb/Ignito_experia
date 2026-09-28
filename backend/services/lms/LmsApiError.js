export class LmsApiError extends Error {
  constructor(code, message, { status = null, transient = false, cause = null, retryAfterMs = null } = {}) {
    super(message);
    this.name = "LmsApiError";
    this.code = code;
    this.status = status;
    this.transient = transient;
    this.retryAfterMs = retryAfterMs;
    if (cause) this.cause = cause;
  }
}
