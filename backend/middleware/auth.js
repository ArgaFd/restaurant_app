const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');
const { pool } = require('../config/db_postgres');

const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Get user from database
      const result = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(StatusCodes.UNAUTHORIZED).json(
          new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'User not found')
        );
      }
      
      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error(error);
      return res.status(StatusCodes.UNAUTHORIZED).json(
        new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'Not authorized')
      );
    }
  }
  
  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED).json(
      new ApiResponse(StatusCodes.UNAUTHORIZED, null, 'Not authorized, no token')
    );
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json(
        new ApiResponse(StatusCodes.FORBIDDEN, null, 'Not authorized to access this route')
      );
    }
    next();
  };
};

module.exports = { protect, authorize };
