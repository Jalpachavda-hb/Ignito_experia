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

export const registerWithCredentials = async (payload: any) => {
  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    });

    if (!data.success && data.message) {
      throw new Error(data.message);
    }

    return data;
  } catch (err: any) {
    throw err;
  }
};

export const logoutUser = async () => {
  try {
    const data = await apiRequest('/auth/logout', {
      method: 'POST',
      auth: false,
    });
    return data;
  } catch (err: any) {
    throw err;
  }
};

