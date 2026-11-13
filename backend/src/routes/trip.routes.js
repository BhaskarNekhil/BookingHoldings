const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middleware/auth.middleware");
const idempotency = require('../middleware/idempotency.middleware');

const router = express.Router();

router.post("/", requireAuth, idempotency, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      role,
      destination,
      checkIn,
      checkOut,
      budgetInr,
      itinerary = null,
      interests = [],
    } = req.body;

    if (!['creator', 'seeker'].includes(role)) {
      return res.status(400).json({ message: "role must be creator or seeker" });
    }

    await client.query("BEGIN");

    const destinationResult = await client.query(
      "SELECT city FROM destinations WHERE city = $1",
      [destination]
    );

    if (!destinationResult.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Select a valid destination" });
    }

    const tripResult = await client.query(
      `
      INSERT INTO trips (
        user_id, role, destination, check_in,
        check_out, budget_inr, itinerary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        req.user.userId,
        role,
        destination,
        checkIn,
        checkOut,
        budgetInr,
        itinerary,
      ]
    );

    const trip = tripResult.rows[0];

    for (const interestId of interests) {
      await client.query(
        `
        INSERT INTO trip_interests (trip_id, interest_id)
        VALUES ($1, $2)
        `,
        [trip.id, interestId]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ trip });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "P0001") {
      return res.status(409).json({ message: error.message });
    }

    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
