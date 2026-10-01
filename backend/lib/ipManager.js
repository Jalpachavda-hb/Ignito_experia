export const getPublicIp = (session) => {
  if (!session) return null;
  return session.publicIp || session.taskPrivateIp || null;
};

export const getPrivateIp = (session) => {
  if (!session) return null;
  return session.taskPrivateIp || null;
};

/**
 * Detect whether the backend is running directly on an AWS EC2 instance / cloud server
 * where direct network communication with the ECS container (via Private IP) is available.
 */
export const isAwsInstance = () => {
  if (process.env.CONTAINER_COMMUNICATION_MODE === "direct") return true;
  if (process.env.CONTAINER_COMMUNICATION_MODE === "local" || process.env.CONTAINER_COMMUNICATION_MODE === "ssm") return false;
  if (process.env.IS_AWS_INSTANCE === "true") return true;
  if (process.env.IS_LOCAL_DEV === "true") return false;

  // Explicit private mode or production environment
  if (process.env.CONTAINER_HOST_MODE === "private" || process.env.NODE_ENV === "production") {
    return true;
  }

  // Windows is local development environment
  if (process.platform === "win32") {
    return false;
  }

  // On Linux/Cloud servers, default to direct communication on the VPC network
  return true;
};

export const isDirectContainerMode = isAwsInstance;
export const isLocalMode = () => !isAwsInstance();

// Automatic environment detection (Development = Public IP, Production = Private IP)
export const isPrivateMode = process.env.NODE_ENV === "production" || process.env.CONTAINER_HOST_MODE === "private";

export const getContainerHost = (session) => {
  if (!session) return null;
  if (isDirectContainerMode() || isPrivateMode) {
    return getPrivateIp(session) || session.publicIp || null;
  }
  // Windows = Local development, must use Public IP (or fallback to taskPrivateIp if SSM tunnel is used)
  if (process.platform === "win32") {
    return getPublicIp(session);
  }
  // Linux (EC2) = Production/Live mode, prefer Private IP for speed/security
  return session.taskPrivateIp || session.publicIp || null;
};

