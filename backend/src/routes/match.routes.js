const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const { listMatches } = require('../controllers/match.controller');

const router = express.Router();

router.get("/", requireAuth, listMatches);

module.exports = router;
