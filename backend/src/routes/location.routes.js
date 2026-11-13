const router = require("express").Router();
const controller = require("../controllers/location.controller");
router.get("/search", controller.search);
module.exports = router;
