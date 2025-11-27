const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post(
  '/register',
  [
    body('name', 'Name is required').not().isEmpty(),
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Please enter a password with 6+ characters').isLength({ min: 6 })
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password is required').exists()
  ],
  authController.login
);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateProfile);

// Admin only routes
router.get('/users', [protect, authorize('admin')], authController.getUsers);
router.put('/users/:id/role', [protect, authorize('admin')], authController.updateUserRole);
router.delete('/users/:id', [protect, authorize('admin')], authController.deleteUser);

module.exports = router;
