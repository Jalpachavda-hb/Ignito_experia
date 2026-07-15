// DEPRECATED & DELETED: AWS CLI execute-command and SSM execution are disabled.
export const getSsmEnv = () => {
  return {};
};
export const stripSsmNoise = (stdout) => {
  return stdout || "";
};
export const executeAwsCommand = async () => {
  throw new Error("AWS CLI SSM execution is disabled. Use direct HTTP endpoints.");
};
