const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { pool } = require('../config/db_postgres');

// @desc    Create payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = async (req, res) => {
  try {
    const { order_id, amount, payment_method } = req.body;
    const userId = req.user.id;

    if (!order_id || !amount || !payment_method) {
      return res.status(400).json({
        success: false,
        message: "order_id, amount, dan payment_method wajib diisi",
      });
    }

    // Check if order exists
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if payment already exists for this order
    const existingPayment = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1',
      [order_id]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Payment already exists for this order",
      });
    }

    // Insert payment sesuai struktur tabel asli
    const result = await pool.query(
      `
      INSERT INTO payments (order_id, amount, payment_method, status, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, order_id, amount, payment_method, status, created_at
      `,
      [order_id, amount, payment_method, "completed"]
    );

    // Update order status to completed
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', order_id]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Payment berhasil diproses",
    });

  } catch (error) {
    console.error("Payment processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Error processing payment",
      data: null,
    });
  }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin/Staff)
exports.getPayments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countRes = await pool.query("SELECT COUNT(*) FROM payments");
    const totalItems = parseInt(countRes.rows[0].count);

    const payments = await pool.query(
      `
      SELECT p.id, p.order_id, p.amount, p.payment_method, p.status, p.created_at,
             o.table_number, o.customer_name, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      payments: payments.rows,
    });

  } catch (error) {
    console.error("Get payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payments",
      data: null,
    });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPaymentById = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT p.id, p.order_id, p.amount, p.payment_method, p.status, p.created_at,
             o.table_number, o.customer_name, o.total_amount, o.status as order_status
      FROM payments p
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE p.id = $1
      `,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Payment retrieved successfully",
    });
  } catch (error) {
    console.error("Get payment error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payment",
      data: null,
    });
  }
};

// @desc    Update payment status
// @route   PUT /api/payments/:id/status
// @access  Private (Admin/Staff)
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE payments SET status = $1 WHERE id = $2 RETURNING id, order_id, amount, payment_method, status, created_at',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: "Payment status updated successfully",
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment status",
      data: null,
    });
  }
};
