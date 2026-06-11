export class HttpError extends Error {
  constructor(message, statusCode = 500, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

export const badRequest = (message, extra) => new HttpError(message, 400, extra);
export const unauthorized = (message = "Unauthorized") => new HttpError(message, 401);
export const forbidden = (message = "Forbidden") => new HttpError(message, 403);
export const notFound = (message = "Not found") => new HttpError(message, 404);
