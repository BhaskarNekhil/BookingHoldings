const crypto = require("node:crypto");
const logger = require("../config/logger");

module.exports = function requestLogger(req, res, next) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () =>
    logger.info({
      requestId,
      method: req.method,
      route:
        req.route?.path ||
        req.path
          .split("/")
          .map((part) => (/^[0-9a-f-]{20,}$/i.test(part) ? ":id" : part))
          .join("/"),
      status: res.statusCode,
      durationMs: Date.now() - started,
    }),
  );
  next();
};
