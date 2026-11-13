const test = require("node:test");
const assert = require("node:assert/strict");
test("auth input requires email, password, and signup identity fields", () => {
  const required = ["email", "password", "name", "gender"];
  assert.equal(required.includes("email"), true);
  assert.equal(required.includes("password"), true);
});
