import crypto from "crypto";
import axios from "axios";
import { lmsTokenService } from "./LmsTokenService.js";
import { LmsApiError } from "./LmsApiError.js";

const TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class LmsApiClient {
  /**
   * Authenticated LMS POST. Uses the tenant Auth0 M2M token unless bearerToken is supplied.
   * The M2M token stays on the server.
   */
  async post({ tenantId, url, data, correlationId, bearerToken }) {
    if (!url) {
      throw new LmsApiError(
        "LMS_PROVIDER_CONFIGURATION_MISSING",
        "LMS endpoint URL is not configured"
      );
    }

    const cid = correlationId || crypto.randomUUID();
    const useM2M = !bearerToken;
    let token = bearerToken;

    if (useM2M) {
      try {
        token = await lmsTokenService.getAccessToken(tenantId);
      } catch (err) {
        const code = err.code === "LMS_M2M_CLIENT_SECRET_MISSING"
          ? "LMS_PROVIDER_CONFIGURATION_MISSING"
          : "LMS_AUTHENTICATION_FAILED";
        throw new LmsApiError(code, err.message || "LMS authentication failed", { cause: err });
      }
    }

    return this.sendWithRetry({
      token,
      url,
      data,
      correlationId: cid,
      tenantId,
      useM2M,
      retriedAuth: false,
      retriedTransient: false,
    });
  }

  async sendWithRetry(ctx) {
    try {
      return await this.send(ctx);
    } catch (error) {
      if (
        error instanceof LmsApiError &&
        error.code === "LMS_API_UNAUTHORIZED" &&
        ctx.useM2M &&
        !ctx.retriedAuth
      ) {
        console.warn(`[LmsApiClient] 401 for tenant ${ctx.tenantId}. Refreshing M2M token once. correlationId=${ctx.correlationId}`);
        await lmsTokenService.invalidateToken(ctx.tenantId);
        const token = await lmsTokenService.getAccessToken(ctx.tenantId);
        return this.sendWithRetry({ ...ctx, token, retriedAuth: true });
      }

      if (error instanceof LmsApiError && error.transient && !ctx.retriedTransient) {
        const waitMs = Math.min(Number(error.retryAfterMs || 1000), 5000);
        console.warn(`[LmsApiClient] Transient LMS status ${error.status}. Retrying once. correlationId=${ctx.correlationId}`);
        await sleep(waitMs);
        return this.sendWithRetry({ ...ctx, retriedTransient: true });
      }

      if (error instanceof LmsApiError) throw error;
      throw this.normalize(error, ctx.correlationId);
    }
  }

  async send({ token, url, data, correlationId }) {
    try {
      const response = await axios.post(url, data ?? {}, {
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Correlation-Id": correlationId,
        },
      });

      console.log(`[LmsApiClient] POST status=${response.status} correlationId=${correlationId}`);

      if (response.status === 401 || response.status === 403) {
        throw new LmsApiError("LMS_API_UNAUTHORIZED", "LMS rejected the API credential", {
          status: response.status,
        });
      }
      if (response.status === 404) {
        throw new LmsApiError("LMS_STUDENT_NOT_FOUND", "LMS student record was not found", {
          status: 404,
        });
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers?.["retry-after"] || 1);
        throw new LmsApiError("LMS_PROFILE_UNAVAILABLE", "LMS rate limited the request", {
          status: 429,
          transient: true,
          retryAfterMs: (Number.isFinite(retryAfter) ? retryAfter : 1) * 1000,
        });
      }
      if (response.status >= 500) {
        throw new LmsApiError("LMS_PROFILE_UNAVAILABLE", "LMS API returned a server error", {
          status: response.status,
          transient: true,
        });
      }
      if (response.status >= 400) {
        throw new LmsApiError("LMS_PROFILE_UNAVAILABLE", `LMS API error ${response.status}`, {
          status: response.status,
        });
      }

      return response.data;
    } catch (error) {
      if (error instanceof LmsApiError) throw error;
      throw this.normalize(error, correlationId);
    }
  }

  normalize(error, correlationId) {
    if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
      console.error(`[LmsApiClient] Timeout correlationId=${correlationId}`);
      return new LmsApiError("LMS_API_TIMEOUT", "LMS API timed out", { cause: error });
    }
    console.error(`[LmsApiClient] Request failed correlationId=${correlationId}: ${error?.message || "unknown"}`);
    return new LmsApiError("LMS_PROFILE_UNAVAILABLE", error?.message || "LMS API request failed", {
      cause: error,
    });
  }
}

export const lmsApiClient = new LmsApiClient();
