import axios from "axios";

import {
  lmsTokenService,
} from "./LmsTokenService.js";

class LmsApiClient {
  async post({
    tenantId,
    url,
    data,
  }) {
    let token =
      await lmsTokenService
        .getAccessToken(tenantId);

    try {
      return await this.send({
        token,
        url,
        data,
      });
    } catch (error) {
      // Token expired/revoked
      if (
        error.response?.status === 401
      ) {
        console.warn("[LmsApiClient] Received 401 with M2M token. Invalidating token and retrying once...");
        await lmsTokenService
          .invalidateToken(tenantId);

        token =
          await lmsTokenService
            .getAccessToken(tenantId);

        // Only ONE retry
        return await this.send({
          token,
          url,
          data,
        });
      }

      throw error;
    }
  }

  async send({
    token,
    url,
    data,
  }) {
    const response =
      await axios.post(
        url,
        data,
        {
          timeout: 15000,

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },
        }
      );

    return response.data;
  }
}

export const lmsApiClient =
  new LmsApiClient();
