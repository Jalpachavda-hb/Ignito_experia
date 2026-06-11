import { apiRequest } from '../lib/apiClient';

export const loginWithCredentials = async ({ email, password }: any) => {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });

    if (!data.success && data.message) {
      throw new Error(data.message);
    }

    return data;
  } catch (err: any) {
    throw err;
  }
};
