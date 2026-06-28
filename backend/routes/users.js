import express from 'express';
import userService from '../services/UserService.js';
import { hasPermission } from '../middleware/rbacMiddleware.js';

const router = express.Router();

// Helper to format success responses
const successResponse = (res, message, data = {}, pagination = {}) => {
  res.json({
    success: true,
    message,
    data,
    pagination
  });
};

// Helper to format error responses
const errorResponse = (res, err) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error"
  });
};

// GET /api/users
router.get('/', hasPermission('Users.View'), async (req, res) => {
  try {
    const result = await userService.getAllUsers(req.query);
    successResponse(res, "Users retrieved successfully", result.data, result.pagination);
  } catch (err) {
    errorResponse(res, err);
  }
});

// GET /api/users/:id
router.get('/:id', hasPermission('Users.View'), async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    successResponse(res, "User retrieved successfully", user);
  } catch (err) {
    errorResponse(res, err);
  }
});

// POST /api/users
router.post('/', hasPermission('Users.Create'), async (req, res) => {
  try {
    const authContext = req.auth || (req.apiGateway && req.apiGateway.event && req.apiGateway.event.auth) || {};
    const createdBy = authContext.userId || null;
    
    const newUser = await userService.createUser({ ...req.body, createdBy });
    successResponse(res, "User created successfully", newUser);
  } catch (err) {
    errorResponse(res, err);
  }
});

// PUT /api/users/:id
router.put('/:id', hasPermission('Users.Update'), async (req, res) => {
  try {
    const authContext = req.auth || (req.apiGateway && req.apiGateway.event && req.apiGateway.event.auth) || {};
    const updatedBy = authContext.userId || null;
    
    const updatedUser = await userService.updateUser(req.params.id, { ...req.body, updatedBy });
    successResponse(res, "User updated successfully", updatedUser);
  } catch (err) {
    errorResponse(res, err);
  }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', hasPermission('Users.Update'), async (req, res) => {
  try {
    const authContext = req.auth || (req.apiGateway && req.apiGateway.event && req.apiGateway.event.auth) || {};
    const updatedBy = authContext.userId || null;
    
    const updatedUser = await userService.updateUserStatus(req.params.id, req.body.status, updatedBy);
    successResponse(res, `User status updated to ${req.body.status}`, updatedUser);
  } catch (err) {
    errorResponse(res, err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', hasPermission('Users.Delete'), async (req, res) => {
  try {
    const authContext = req.auth || (req.apiGateway && req.apiGateway.event && req.apiGateway.event.auth) || {};
    const deletedBy = authContext.userId || null;
    
    await userService.deleteUser(req.params.id, deletedBy);
    successResponse(res, "User deleted successfully");
  } catch (err) {
    errorResponse(res, err);
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', hasPermission('Users.Update'), async (req, res) => {
  try {
    const result = await userService.resetPassword(req.params.id, req.body.newPassword);
    successResponse(res, result.message);
  } catch (err) {
    errorResponse(res, err);
  }
});

// POST /api/users/import
router.post('/import', hasPermission('Users.Create'), async (req, res) => {
  try {
    const authContext = req.auth || (req.apiGateway && req.apiGateway.event && req.apiGateway.event.auth) || {};
    const createdBy = authContext.userId || null;
    
    const result = await userService.importUsers(req.body.users, createdBy);
    successResponse(res, "Import completed", result);
  } catch (err) {
    errorResponse(res, err);
  }
});

export default router;
