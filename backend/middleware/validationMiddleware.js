import Joi from 'joi';
import { badRequest } from '../lib/errors.js';

export const validateDto = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      // You can either throw a custom error to be caught by errorHandler or respond directly
      throw badRequest(`Validation Error: ${errorMessages}`);
    }

    // Replace req.body with validated value (strips unknown fields)
    req.body = value;
    next();
  };
};
