class LmsSecretProvider {
  async getClientSecret() {
    const secret =
      process.env.LMS_M2M_CLIENT_SECRET;

    if (!secret) {
      const error = new Error(
        "LMS_M2M_CLIENT_SECRET_MISSING"
      );

      error.code =
        "LMS_M2M_CLIENT_SECRET_MISSING";

      throw error;
    }

    return secret;
  }
}

export const lmsSecretProvider =
  new LmsSecretProvider();
