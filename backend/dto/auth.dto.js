import Joi from 'joi';

export const loginDto = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  // For tracking
  device: Joi.string().optional().allow('', null),
  os: Joi.string().optional().allow('', null),
  browser: Joi.string().optional().allow('', null),
});

export const lmsLoginDto = Joi.object({
  token: Joi.string().required(),
  // For tracking
  device: Joi.string().optional().allow('', null),
  os: Joi.string().optional().allow('', null),
  browser: Joi.string().optional().allow('', null),
});

export const refreshDto = Joi.object({
  refreshToken: Joi.string().required(),
});
