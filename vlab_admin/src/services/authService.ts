import {
  loginWithCredentials as loginApi,
  registerWithCredentials as registerApi,
  logoutUser as logoutApi,
} from '../Utils/PostApiHandler';

export const loginWithCredentials = async ({ email, password, slug }: any) => {
  try {
    const data = await loginApi({ email, password, slug });
    if (data && !data.success && data.message) {
      throw new Error(data.message);
    }
    return data;
  } catch (err: any) {
    throw err;
  }
};

export const registerWithCredentials = async (payload: any) => {
  try {
    const data = await registerApi(payload);
    if (data && !data.success && data.message) {
      throw new Error(data.message);
    }
    return data;
  } catch (err: any) {
    throw err;
  }
};

export const logoutUser = async () => {
  try {
    const data = await logoutApi();
    return data;
  } catch (err: any) {
    throw err;
  }
};


