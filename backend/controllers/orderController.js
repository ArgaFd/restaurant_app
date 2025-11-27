const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { pool } = require('../config/db_postgres');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  const { tableNumber, customerName, items, paymentMethod } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Calculate total amount and validate menu items
    let totalAmount = 0;
    const orderItems = [];
    
    // Validate all menu items exist and are available
    for (const item of items) {
      const result = await client.query(
        'SELECT * FROM menu WHERE id = $1 AND is_available = true',
        [item.menuId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(StatusCodes.BAD_REQUEST).json(
          new ApiResponse(StatusCodes.BAD_REQUEST, null, `Menu item with ID ${item.menuId} not found or not available`)
        );
      }
      
      const menuItem = result.rows[0];
      const subtotal = parseFloat(menuItem.price) * item.quantity;
      totalAmount += subtotal;
      
      orderItems.push({
        menuId: item.menuId,
        quantity: item.quantity,
        unitPrice: parseFloat(menuItem.price),
        subtotal,
        specialInstructions: item.specialInstructions || null
      });
    }

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (table_number, customer_name, total_amount, status, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tableNumber, customerName, totalAmount, 'pending', req.user.id]
    );
    
    const order = orderResult.rows[0];

    // Create order items
    for (const item of orderItems) {
      await client.query(
        'INSERT INTO order_items (order_id, menu_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)',
        [order.id, item.menuId, item.quantity, item.unitPrice, item.subtotal]
      );
    }

    // Create payment record if payment method is provided
    if (paymentMethod) {
      await client.query(
        'INSERT INTO payments (order_id, amount, method, status) VALUES ($1, $2, $3, $4)',
        [order.id, totalAmount, paymentMethod, 'pending']
      );
    }

    await client.query('COMMIT');

    // Get complete order with items
    const completeOrder = await client.query(`
      SELECT o.*, 
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'menuId', oi.menu_id,
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price,
                 'subtotal', oi.subtotal,
                 'menuItem', json_build_object(
                   'id', m.id,
                   'name', m.name,
                   'price', m.price
                 )
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu m ON oi.menu_id = m.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [order.id]);

    res.status(StatusCodes.CREATED).json(
      new ApiResponse(StatusCodes.CREATED, completeOrder.rows[0], 'Order created successfully')
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  } finally {
    client.release();
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin/Staff)
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*, u.name as user_name,
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'menuId', oi.menu_id,
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price,
                 'subtotal', oi.subtotal,
                 'menuItem', json_build_object(
                   'id', m.id,
                   'name', m.name,
                   'price', m.price
                 )
               )
             ) as items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu m ON oi.menu_id = m.id
    `;
    
    const params = [];
    
    if (status) {
      query += ' WHERE o.status = $1';
      params.push(status);
    }
    
    query += ' GROUP BY o.id, u.name ORDER BY o.created_at DESC';
    
    // Get total count
    const countQuery = status 
      ? 'SELECT COUNT(*) FROM orders WHERE status = $1'
      : 'SELECT COUNT(*) FROM orders';
    const countResult = await pool.query(countQuery, status ? [status] : []);
    const totalItems = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page),
      orders: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Get my orders
// @route   GET /api/orders/my
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT o.*, 
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'menuId', oi.menu_id,
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price,
                 'subtotal', oi.subtotal,
                 'menuItem', json_build_object(
                   'id', m.id,
                   'name', m.name,
                   'price', m.price
                 )
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu m ON oi.menu_id = m.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [req.user.id]
    );
    const totalItems = parseInt(countResult.rows[0].count);
    
    const result = await pool.query(query, [req.user.id, parseInt(limit), offset]);
    
    res.json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page),
      orders: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const query = `
      SELECT o.*, u.name as user_name,
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'menuId', oi.menu_id,
                 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price,
                 'subtotal', oi.subtotal,
                 'menuItem', json_build_object(
                   'id', m.id,
                   'name', m.name,
                   'price', m.price,
                   'description', m.description
                 )
               )
             ) as items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu m ON oi.menu_id = m.id
      WHERE o.id = $1
      GROUP BY o.id, u.name
    `;
    
    const result = await pool.query(query, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'Order not found')
      );
    }
    
    const order = result.rows[0];
    
    // Check if user owns the order or is admin/staff
    if (order.user_id !== req.user.id && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json(
        new ApiResponse(StatusCodes.FORBIDDEN, null, 'Not authorized to access this order')
      );
    }
    
    res.json(
      new ApiResponse(StatusCodes.OK, order, 'Order retrieved successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin/Staff)
exports.updateOrderStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { status } = req.body;
    
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'Order not found')
      );
    }
    
    res.json(
      new ApiResponse(StatusCodes.OK, result.rows[0], 'Order status updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Update payment status
// @route   PUT /api/orders/:id/payment
// @access  Private (Admin/Staff)
exports.updatePaymentStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { status, amount } = req.body;
    
    const result = await pool.query(
      'UPDATE payments SET status = $1, amount = $2, updated_at = CURRENT_TIMESTAMP WHERE order_id = $3 RETURNING *',
      [status, amount, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'Payment not found for this order')
      );
    }
    
    res.json(
      new ApiResponse(StatusCodes.OK, result.rows[0], 'Payment status updated successfully')
    );
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};
