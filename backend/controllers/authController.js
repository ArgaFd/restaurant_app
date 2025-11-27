const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const { pool } = require('../config/db_postgres');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  const client = await pool.connect();

  try {
    const { name, email, password, role = 'staff' } = req.body;

    // Check if user already exists
    const userExists = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json(
        new ApiResponse(StatusCodes.BAD_REQUEST, null, 'User already exists')
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id, user.role);

    res.status(StatusCodes.CREATED).json(
      new ApiResponse(StatusCodes.CREATED, {
        user,
        token,
        message: 'User registered successfully'
      })
    );
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to register user')
    );
  } finally {
    client.release();
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { email, password } = req.body;

    // Check if user exists
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(StatusCodes.UNAUTHORIZED).json(
        new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'Invalid credentials')
      );
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(StatusCodes.UNAUTHORIZED).json(
        new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'Invalid credentials')
      );
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, {
        user: userWithoutPassword,
        token,
        message: 'Login successful'
      })
    );
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to login')
    );
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'User not found')
      );
    }

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, result.rows[0])
    );
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to get user profile')
    );
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  const client = await pool.connect();

  try {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user
    const userResult = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'User not found')
      );
    }

    const user = userResult.rows[0];
    const updates = [];
    const values = [userId];
    let valueIndex = 2;

    // Update name if provided
    if (name) {
      updates.push(`name = $${valueIndex++}`);
      values.push(name);
    }

    // Update email if provided
    if (email && email !== user.email) {
      // Check if new email is already taken
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(StatusCodes.BAD_REQUEST).json(
          new ApiResponse(StatusCodes.BAD_REQUEST, null, 'Email already in use')
        );
      }

      updates.push(`email = $${valueIndex++}`);
      values.push(email);
    }

    // Update password if current password is provided
    if (currentPassword && newPassword) {
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(StatusCodes.UNAUTHORIZED).json(
          new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'Current password is incorrect')
        );
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      updates.push(`password = $${valueIndex++}`);
      values.push(hashedPassword);
    }

    // If there are updates to make
    if (updates.length > 0) {
      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING id, name, email, role, created_at
      `;

      const result = await client.query(query, values);
      const updatedUser = result.rows[0];

      return res.status(StatusCodes.OK).json(
        new ApiResponse(StatusCodes.OK, {
          user: updatedUser,
          message: 'Profile updated successfully'
        })
      );
    }

    // If no updates were made
    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.created_at
        },
        message: 'No changes were made'
      })
    );
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to update profile')
    );
  } finally {
    client.release();
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const totalItems = parseInt(countResult.rows[0].count);

    // Get paginated users
    const result = await pool.query(
      `SELECT id, name, email, role, created_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: parseInt(page),
        users: result.rows
      })
    );
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to get users')
    );
  }
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/users/:id/role
// @access  Private/Admin
exports.updateUserRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      new ApiResponse(StatusCodes.BAD_REQUEST, { errors: errors.array() }, 'Validation error')
    );
  }

  try {
    const { role } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'User not found')
      );
    }

    // Update user role
    const result = await pool.query(
      `UPDATE users 
       SET role = $1 
       WHERE id = $2 
       RETURNING id, name, email, role, created_at`,
      [role, userId]
    );

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, {
        user: result.rows[0],
        message: 'User role updated successfully'
      })
    );
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to update user role')
    );
  }
};

// @desc    Delete user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting self
    if (userId === req.user.id) {
      return res.status(StatusCodes.BAD_REQUEST).json(
        new ApiResponse(StatusCodes.BAD_REQUEST, null, 'You cannot delete your own account')
      );
    }

    // Delete user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name, email',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json(
        new ApiResponse(StatusCodes.NOT_FOUND, null, 'User not found')
      );
    }

    res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, {
        user: result.rows[0],
        message: 'User deleted successfully'
      })
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
      new ApiResponse(StatusCodes.INTERNAL_SERVER_ERROR, null, 'Failed to delete user')
    );
  }
};