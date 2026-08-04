export const getPublicIp = (session) => {
  if (!session) return null;
  return session.publicIp || session.taskPrivateIp || null;
};

export const getPrivateIp = (session) => {
  if (!session) return null;
  return session.taskPrivateIp || null;
};

// Automatic environment detection (Development = Public IP, Production = Private IP)
export const isPrivateMode = process.env.NODE_ENV === "production" || process.env.CONTAINER_HOST_MODE === "private";

export const getContainerHost = (session) => {
  if (!session) return null;
  if (isPrivateMode) {
    return getPrivateIp(session);
  }
  // Windows = Local development, must use Public IP
  if (process.platform === "win32") {
    return getPublicIp(session);
  }
  // Linux (EC2) = Production/Live mode, prefer Private IP for speed/security
  return session.taskPrivateIp || session.publicIp || null;
};
