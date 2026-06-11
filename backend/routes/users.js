import express from 'express';
import { getAllUsers, addUser, updateUserStatusById } from '../data/users.js';

const router = express.Router();

// GET /api/users
router.get('/', (req, res) => {
  res.json({
    success: true,
    users: getAllUsers()
  });
});

// POST /api/users
router.post('/', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const newUser = addUser({ name, email, password, role });
  res.json({ success: true, message: 'User created successfully', user: newUser });
});

// PATCH /api/users/:id/status
router.patch('/:id/status', (req, res) => {
  const user = updateUserStatusById(req.params.id, req.body.status);
  if (user) {
    res.json({ success: true, message: `User ${req.params.id} status updated to ${req.body.status}` });
  } else {
    res.status(404).json({ success: false, message: "User not found" });
  }
});

export default router;
