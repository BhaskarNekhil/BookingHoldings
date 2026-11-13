const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const controller = require("../controllers/match.controller");
router.get("/", requireAuth, controller.listMatches);
module.exports = router;
