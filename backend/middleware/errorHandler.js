export const errorHandler = (err, req, res, _next) => {
  console.error(`[API Error] ${req.method} ${req.url}:`, err.message);
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token', errorCode: 'INVALID_TOKEN' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired', errorCode: 'TOKEN_EXPIRED' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
    errorCode: err.errorCode || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    ...(process.env.NODE_ENV !== "production" && err.stack ? { stack: err.stack } : {}),
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
};
