const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const controller = require("../controllers/hotel.controller");
router.get("/groups/:groupId/hotels", requireAuth, controller.list);
module.exports = router;
