const { StatusCodes } = require('http-status-codes');
const ApiResponse = require('../utils/apiResponse');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Default error
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Internal Server Error';

  // Handle specific errors
  if (err.name === 'ValidationError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message = err.message;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Token expired';
  } else if (err.code === '23505') { // Unique violation
    statusCode = StatusCodes.CONFLICT;
    message = 'Email already exists';
  }

  res.status(statusCode).json(new ApiResponse(statusCode, null, message));
};

module.exports = errorHandler;
