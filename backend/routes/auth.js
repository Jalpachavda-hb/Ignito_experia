import express from 'express';
import { findUserByCredentials } from '../data/users.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);

    const { email, loginId, password } = req.body;

    const userEmail = email || loginId;

    const user = findUserByCredentials(userEmail, password);

    if (user) {
      // Return user without password
      const { password: _pw, ...safeUser } = user;
      return res.json({
        success: true,
        user: safeUser,
        token: "demo-jwt-token-12345"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;
