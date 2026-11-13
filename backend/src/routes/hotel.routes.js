const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/groups/:groupId/hotels", requireAuth, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const contextResult = await pool.query(
      `
      SELECT g.id, t.destination, t.check_in, t.check_out, t.budget_inr,
             COUNT(gm.user_id)::int AS member_count
      FROM groups g
      JOIN trips t ON t.id = g.trip_id
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = $1
        AND EXISTS (
          SELECT 1 FROM group_members mine
          WHERE mine.group_id = g.id AND mine.user_id = $2
        )
      GROUP BY g.id, t.id
      `,
      [groupId, req.user.userId]
    );

    const context = contextResult.rows[0];

    if (!context) {
      return res.status(404).json({ message: "Group not found or access denied" });
    }

    // Use the lowest relevant member budget so the shared stay is affordable
    // to everyone. Existing members with no seeker trip use the group's budget.
    const budgets = await pool.query(`SELECT MIN(s.budget_inr)::int AS lowest_budget
      FROM group_members m JOIN trips s ON s.user_id=m.user_id
      WHERE m.group_id=$1 AND s.role='seeker' AND s.status='active'
        AND s.destination=$2 AND s.check_in<$4 AND s.check_out>$3`,
      [groupId, context.destination, context.check_in, context.check_out]);
    const budgetLimit = Math.min(context.budget_inr,
      budgets.rows[0].lowest_budget ?? context.budget_inr);

    const nights = Math.round(
      (Date.parse(context.check_out) - Date.parse(context.check_in)) / 86400000
    );
    const result = await pool.query(
      `
      SELECT h.id AS hotel_id, h.name AS hotel_name, h.city, h.area,
             h.rating, h.stars, h.image,
             r.id AS room_id, r.name AS room_name, r.room_type,
             r.max_adults, r.max_children, r.price_amount,
             r.currency, r.refundable,
             MIN(a.rooms_left)::int AS minimum_rooms_left,
             COUNT(a.stay_date)::int AS available_nights
      FROM hotels h
      JOIN rooms r ON r.hotel_id = h.id
      JOIN availability a ON a.room_id = r.id
        AND a.stay_date >= $2
        AND a.stay_date < $3
      WHERE h.city = $1
      GROUP BY h.id, r.id
      HAVING COUNT(a.stay_date) = $4
      ORDER BY h.rating DESC, r.price_amount ASC
      `,
      [context.destination, context.check_in, context.check_out, nights]
    );

    const hotels = result.rows
      .map((option) => {
        const roomsRequired = Math.ceil(context.member_count / option.max_adults);
        return {
          ...option,
          rooms_required: roomsRequired,
          total_cost_inr: option.price_amount * nights * roomsRequired,
          cost_per_member_inr: Math.ceil(
            (option.price_amount * nights * roomsRequired) /
              context.member_count
          ),
          available: option.minimum_rooms_left >= roomsRequired,
        };
      })
      .filter((option) => option.available && option.cost_per_member_inr <= budgetLimit);

    res.json({
      group_id: groupId,
      destination: context.destination,
      check_in: context.check_in,
      check_out: context.check_out,
      member_count: context.member_count,
      budget_limit_inr: budgetLimit,
      hotels,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
