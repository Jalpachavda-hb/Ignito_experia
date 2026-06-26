import express from 'express';
import { validateDto } from '../middleware/validationMiddleware.js';
import { lmsLoginDto } from '../dto/auth.dto.js';
import { ssoService } from '../services/SsoService.js';

const router = express.Router();

router.post('/lms-login', validateDto(lmsLoginDto), async (req, res, next) => {
  try {
    const { token, device, os, browser } = req.body;

    const result = await ssoService.verifyLmsToken({
      token,
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
