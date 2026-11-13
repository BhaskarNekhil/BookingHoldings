const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const idempotency = require("../middleware/idempotency.middleware");
router.post("/signup", idempotency, controller.signup);
router.post("/login", idempotency, controller.login);
module.exports = router;
