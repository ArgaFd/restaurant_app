const express = require('express');
const { body, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updateOrderItemStatus
} = require('../controllers/orderController');

const router = express.Router();

// Protected routes (require authentication)
router.use(protect);

// Customer and Staff can create orders
router.post('/', [
  body('tableNumber', 'Table number is required').isInt({ min: 1 }),
  body('items', 'Order items are required').isArray({ min: 1 }),
  body('items.*.menuId', 'Menu item ID is required').isInt(),
  body('items.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
  body('paymentMethod', 'Payment method is required').optional().isIn(['cash', 'midtrans'])
], createOrder);

// Staff and Owner can view all orders
router.get('/', [
  authorize('staff', 'owner')
], getOrders);

// Anyone can view their own order
router.get('/:id', [
  param('id', 'Please provide a valid order ID').isInt()
], getOrder);

// Staff and Owner can update order status
router.put('/:id/status', [
  authorize('staff', 'owner'),
  param('id', 'Please provide a valid order ID').isInt(),
  body('status', 'Status is required').isIn(['pending', 'processing', 'completed', 'cancelled'])
], updateOrderStatus);

// Staff and Owner can update order item status
router.put('/order-items/:id/status', [
  authorize('staff', 'owner'),
  param('id', 'Please provide a valid order item ID').isInt(),
  body('status', 'Status is required').isIn(['pending', 'preparing', 'ready', 'served', 'cancelled'])
], updateOrderItemStatus);

module.exports = router;
