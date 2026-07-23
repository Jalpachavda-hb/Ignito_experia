export const getPublicIp = (session) => {
  if (!session) return null;
  return session.publicIp || session.taskPrivateIp || null;
};

export const getPrivateIp = (session) => {
  if (!session) return null;
  return session.taskPrivateIp || null;
};

// Automatic environment detection (Development = Public IP, Production = Private IP)
export const isPrivateMode = false 

export const getContainerHost = (session) => {
  if (!session) return null;
  return isPrivateMode ? getPrivateIp(session) : getPublicIp(session);
};
