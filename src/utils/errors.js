/**
 * Custom application error class for standardized API errors
 */
class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standardized error definitions with HTTP status codes and default messages
 */
const ERROR_DEFINITIONS = {
  INVALID_URL: {
    statusCode: 400,
    message: 'The provided URL is not a valid public Instagram URL.'
  },
  UNSUPPORTED_DOMAIN: {
    statusCode: 400,
    message: 'The URL domain is not supported. Only official Instagram domains are accepted.'
  },
  PRIVATE_CONTENT: {
    statusCode: 403,
    message: 'The requested media belongs to a private or restricted account and cannot be accessed.'
  },
  MEDIA_NOT_FOUND: {
    statusCode: 404,
    message: 'The requested media could not be found or may have been deleted.'
  },
  MEDIA_UNAVAILABLE: {
    statusCode: 404,
    message: 'The requested public media could not be retrieved.'
  },
  DOWNLOAD_UNAVAILABLE: {
    statusCode: 503,
    message: 'This media cannot currently be retrieved.'
  },
  MONTHLY_LIMIT_REACHED: {
    statusCode: 429,
    message: 'Monthly development download limit reached.'
  },
  RATE_LIMITED: {
    statusCode: 429,
    message: 'Too many requests from this IP. Please try again later.'
  },
  AUTH_REQUIRED: {
    statusCode: 401,
    message: 'Authentication required. Missing or invalid Bearer token.'
  },
  PROVIDER_ERROR: {
    statusCode: 502,
    message: 'Downstream media retrieval provider encountered an error.'
  },
  TIMEOUT: {
    statusCode: 504,
    message: 'The request timed out while processing public media.'
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    message: 'An unexpected internal error occurred. Please try again later.'
  }
};

/**
 * Helper factory to create standardized AppError instances
 */
function createError(code, customMessage, customStatusCode) {
  const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.INTERNAL_ERROR;
  const statusCode = customStatusCode || definition.statusCode;
  const message = customMessage || definition.message;
  return new AppError(code, message, statusCode);
}

module.exports = {
  AppError,
  ERROR_DEFINITIONS,
  createError
};
