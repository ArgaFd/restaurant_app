const express = require('express');
const { body, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuCategories
} = require('../controllers/menuController');

const router = express.Router();

// Public routes
router.get('/', getMenuItems);
router.get('/categories', getMenuCategories);
router.get('/:id', [
  param('id', 'Please provide a valid menu item ID').isInt()
], getMenuItem);

// Protected routes (require authentication and admin role)
router.use(protect);
router.use(authorize('owner'));

router.post('/', [
  body('name', 'Name is required').not().isEmpty(),
  body('price', 'Please include a valid price').isFloat({ min: 0 }),
  body('category', 'Category is required').not().isEmpty()
], createMenuItem);

router.put('/:id', [
  param('id', 'Please provide a valid menu item ID').isInt(),
  body('price', 'Please include a valid price').optional().isFloat({ min: 0 }),
  body('isAvailable', 'isAvailable must be a boolean').optional().isBoolean()
], updateMenuItem);

router.delete('/:id', [
  param('id', 'Please provide a valid menu item ID').isInt()
], deleteMenuItem);

module.exports = router;
