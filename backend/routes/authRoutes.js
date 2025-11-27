const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { register, login, getMe } = require('../controllers/authController');

const router = express.Router();

// Validation rules
const registerValidationRules = [
  body('name', 'Name is required').not().isEmpty(),
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
];

const loginValidationRules = [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password is required').exists()
];

// Routes
router.post('/register', registerValidationRules, register);
router.post('/login', loginValidationRules, login);
router.get('/me', protect, getMe);

module.exports = router;
