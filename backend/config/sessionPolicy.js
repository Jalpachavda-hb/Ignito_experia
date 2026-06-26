export const sessionPolicy = {
  // Token TTLs in seconds
  AccessTokenTTL: 15 * 60, // 15 minutes
  RefreshTokenTTL: 7 * 24 * 60 * 60, // 7 days
  RememberMeTTL: 30 * 24 * 60 * 60, // 30 days

  // Session Timeouts in seconds
  IdleTimeout: 30 * 60, // 30 minutes
  AbsoluteSessionTimeout: 24 * 60 * 60, // 24 hours maximum absolute duration

  // Limits
  ConcurrentLoginLimit: 3, // Allow up to 3 devices simultaneously
  EnableMultiDevice: true,
  ForceSingleSession: false, // If true, automatically revokes other sessions on new login

  // Security Flags
  RefreshRotationEnabled: true // Invalidate previous refresh token upon use
};

export default sessionPolicy;
