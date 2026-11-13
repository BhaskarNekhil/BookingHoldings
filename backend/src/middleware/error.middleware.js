const logger = require("../config/logger");

module.exports = function errorHandler(error, req, res, next) {
  const requestId = res.getHeader("X-Request-Id");
  // Never log request bodies, headers, tokens, user fields, or SQL parameters.
  logger.error({
    requestId,
    method: req.method,
    route: req.route?.path || req.path,
    errorName: error.name,
    errorCode: error.code || "UNEXPECTED",
    message: error.message,
    stack: error.stack,
  });
  if (res.headersSent) return next(error);
  const status = error.statusCode || 500;
  return res.status(status).json({
    message: status >= 500 ? "Internal server error" : error.message,
    requestId,
  });
};
