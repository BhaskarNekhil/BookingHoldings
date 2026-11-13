const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const idempotency = require("../middleware/idempotency.middleware");
const controller = require("../controllers/request.controller");
router.post("/:groupId", requireAuth, idempotency, controller.create);
router.get("/:groupId", requireAuth, controller.list);
router.patch("/:requestId", requireAuth, idempotency, controller.review);
module.exports = router;
