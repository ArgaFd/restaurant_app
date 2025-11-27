const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { pool } = require('../config/db_postgres');

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
exports.getMenuItems = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM menu WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }
    
    if (search) {
      query += ` AND LOWER(name) LIKE $${params.length + 1}`;
      params.push(`%${search.toLowerCase()}%`);
    }
    
    // Add pagination
    query += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    // Get total count
    const countQuery = 'SELECT COUNT(*) FROM menu';
    const countResult = await pool.query(countQuery);
    const totalItems = parseInt(countResult.rows[0].count);
    
    // Get paginated results
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: parseInt(page),
      items: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
exports.getMenuItem = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM menu WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Menu item not found' 
      });
    }
    
    res.json({ 
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Create a menu item
// @route   POST /api/menu
// @access  Private/Admin
exports.createMenuItem = async (req, res) => {
  console.log('Request body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { name, description, price, category, isAvailable = true, imageUrl } = req.body;
    console.log('Extracted values:', { name, description, price, category, isAvailable, imageUrl });

    const query = `
      INSERT INTO menu (name, description, price, category, is_available, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [name, description, price, category, isAvailable, imageUrl];
    console.log('Query:', query);
    console.log('Values:', values);

    const result = await pool.query(query, values);
    console.log('Result:', result.rows[0]);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Menu item created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error in createMenuItem:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Server error')
    );
  }
};

// @desc    Update a menu item
// @route   PUT /api/menu/:id
// @access  Private/Admin
exports.updateMenuItem = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { id } = req.params;
    const { name, description, price, category, isAvailable, imageUrl } = req.body;
    
    // Check if menu item exists
    const checkResult = await pool.query('SELECT * FROM menu WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(parseFloat(price));
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }
    if (isAvailable !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      values.push(isAvailable);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(imageUrl);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    values.push(id);
    
    const query = `
      UPDATE menu 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Menu item updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update menu item',
      error: error.message 
    });
  }
};

// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Private/Admin
exports.deleteMenuItem = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Menu item not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete menu item',
      error: error.message 
    });
  }
};

// @desc    Get all menu categories
// @route   GET /api/menu/categories
// @access  Public
exports.getMenuCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM menu ORDER BY category ASC');
    const categories = result.rows.map(row => row.category);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error getting menu categories:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve menu categories',
      error: error.message 
    });
  }
};
