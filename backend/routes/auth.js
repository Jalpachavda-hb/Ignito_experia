import express from 'express';
import { validateDto } from '../middleware/validationMiddleware.js';
import { loginDto, refreshDto } from '../dto/auth.dto.js';
import authService from '../services/AuthService.js';

const router = express.Router();

router.post('/login', validateDto(loginDto), async (req, res, next) => {
  try {
    const { email, password, device, os, browser } = req.body;
    
    // Pass basic tracking info
    const result = await authService.login({
      email,
      password,
      ipAddress: req.ip,
      browser,
      os,
      device
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validateDto(refreshDto), async (req, res, next) => {
  try {
    const { refreshToken, device, os, browser } = req.body;

    const result = await authService.refresh({
      refreshToken,
      ipAddress: req.ip,
      browser,
      os,
      device
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
