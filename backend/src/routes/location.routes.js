const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();

    if (query.length < 2) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT city, country, timezone,
             ts_rank(search_vector, plainto_tsquery('simple', $1)) AS text_score,
             similarity(city, $1) AS fuzzy_score
      FROM destinations
      WHERE search_vector @@ plainto_tsquery('simple', $1)
         OR similarity(city, $1) >= 0.20
      ORDER BY GREATEST(
        ts_rank(search_vector, plainto_tsquery('simple', $1)),
        similarity(city, $1)
      ) DESC, city ASC
      LIMIT 10
      `,
      [query]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
