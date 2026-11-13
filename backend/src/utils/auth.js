const jwt = require("jsonwebtoken");

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || "development-only-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

module.exports = { createToken };
