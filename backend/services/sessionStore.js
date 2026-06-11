export const SESSIONS = {};
export const SESSION_FILES = {};

export const clearSessionFiles = (sessionId) => {
  if (SESSION_FILES[sessionId]) {
    delete SESSION_FILES[sessionId];
  }
};
