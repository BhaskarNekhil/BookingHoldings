const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const idempotency = require("../middleware/idempotency.middleware");
const controller = require("../controllers/trip.controller");
router.post("/", requireAuth, idempotency, controller.createTrip);
router.delete("/:tripId", requireAuth, idempotency, controller.deleteSeekerTrip);
module.exports = router;
