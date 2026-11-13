const crypto = require("node:crypto");
const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      name,
      destination,
      checkIn,
      checkOut,
      maxSize,
      budgetInr,
      itinerary = null,
      interests = [],
    } = req.body;

    if (!name || !destination || !checkIn || !checkOut || !maxSize || !budgetInr) {
      return res.status(400).json({
        message: "name, destination, dates, maxSize and budgetInr are required",
      });
    }

    await client.query("BEGIN");

    const tripResult = await client.query(
      `
      INSERT INTO trips (
        user_id, role, destination, check_in,
        check_out, budget_inr, itinerary
      )
      VALUES ($1, 'creator', $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        req.user.userId,
        destination,
        checkIn,
        checkOut,
        budgetInr,
        itinerary,
      ]
    );

    const tripId = tripResult.rows[0].id;
    const groupId = `G-${crypto.randomUUID()}`;

    await client.query(
      `
      INSERT INTO groups (id, trip_id, owner_id, name, max_size)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [groupId, tripId, req.user.userId, name, maxSize]
    );

    await client.query(
      `
      INSERT INTO group_members (group_id, user_id)
      VALUES ($1, $2)
      `,
      [groupId, req.user.userId]
    );

    for (const interestId of interests) {
      await client.query(
        `
        INSERT INTO trip_interests (trip_id, interest_id)
        VALUES ($1, $2)
        `,
        [tripId, interestId]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ groupId, tripId });
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

router.post("/:groupId/requests", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const groupResult = await pool.query(
      `
      SELECT g.id, g.owner_id, g.status, g.max_size,
             COUNT(gm.user_id)::int AS member_count
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = $1
      GROUP BY g.id
      `,
      [groupId]
    );

    const group = groupResult.rows[0];

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.owner_id === req.user.userId) {
      return res.status(400).json({ message: "Owner cannot join own group" });
    }

    if (group.status !== "OPEN" || group.member_count >= group.max_size) {
      return res.status(409).json({ message: "Group has no available place" });
    }

    const result = await pool.query(
      `
      INSERT INTO join_requests (group_id, seeker_id)
      VALUES ($1, $2)
      RETURNING id, group_id, seeker_id, status, created_at
      `,
      [groupId, req.user.userId]
    );

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Request already exists" });
    }
    next(error);
  }
});

router.get("/:groupId/requests", requireAuth, async (req, res, next) => {
  try {
    const ownerResult = await pool.query(
      "SELECT owner_id FROM groups WHERE id = $1",
      [req.params.groupId]
    );

    if (!ownerResult.rows[0]) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (ownerResult.rows[0].owner_id !== req.user.userId) {
      return res.status(403).json({ message: "Only the group owner can view requests" });
    }

    const result = await pool.query(
      `
      SELECT jr.id, jr.status, jr.created_at,
             u.id AS seeker_id, u.name, u.age, u.gender,
             u.home_city, u.gender_preference
      FROM join_requests jr
      JOIN users u ON u.id = jr.seeker_id
      WHERE jr.group_id = $1
      ORDER BY jr.created_at DESC
      `,
      [req.params.groupId]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.patch("/requests/:requestId", requireAuth, async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { status } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
    }

    await client.query("BEGIN");

    const requestResult = await client.query(
      `
      SELECT jr.id, jr.group_id, jr.seeker_id, g.owner_id,
             g.max_size, jr.status, g.status AS group_status
      FROM join_requests jr
      JOIN groups g ON g.id = jr.group_id
      WHERE jr.id = $1
      FOR UPDATE OF jr, g
      `,
      [req.params.requestId]
    );

    const request = requestResult.rows[0];

    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.owner_id !== req.user.userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Only the group owner can review requests" });
    }

    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Request was already reviewed" });
    }

    if (status === "APPROVED") {
      if (request.group_status !== 'OPEN') {
        await client.query('ROLLBACK');
        return res.status(409).json({message:'Group is no longer open'});
      }
      const countResult = await client.query(
        "SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1",
        [request.group_id]
      );

      if (countResult.rows[0].count >= request.max_size) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Group is full" });
      }

      await client.query(
        `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [request.group_id, request.seeker_id]
      );
    }

    await client.query(
      `
      UPDATE join_requests
      SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $3
      `,
      [status, req.user.userId, request.id]
    );

    if (status === "APPROVED") {
      const countResult = await client.query(
        "SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1",
        [request.group_id]
      );

      if (countResult.rows[0].count >= request.max_size) {
        await client.query(
          "UPDATE groups SET status = 'FULL' WHERE id = $1",
          [request.group_id]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: `Request ${status.toLowerCase()}` });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
