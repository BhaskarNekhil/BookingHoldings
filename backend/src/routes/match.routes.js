const express = require("express");
const pool = require("../config/db");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

function nightsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const start = Math.max(Date.parse(firstStart), Date.parse(secondStart));
  const end = Math.min(Date.parse(firstEnd), Date.parse(secondEnd));
  return Math.max(0, Math.round((end - start) / 86400000));
}

function genderAllows(preference, ownGender, otherGender) {
  return preference === "ANY" || ownGender === otherGender;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const tripId = Number(req.query.tripId);

    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const seekerResult = await pool.query(
      `
      SELECT t.*, u.gender, u.gender_preference,
             COALESCE(array_agg(DISTINCT ti.interest_id)
               FILTER (WHERE ti.interest_id IS NOT NULL), '{}') AS interests
      FROM trips t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN trip_interests ti ON ti.trip_id = t.id
      WHERE t.id = $1 AND t.user_id = $2 AND t.role = 'seeker'
      GROUP BY t.id, u.gender, u.gender_preference
      `,
      [tripId, req.user.userId]
    );

    const seeker = seekerResult.rows[0];

    if (!seeker) {
      return res.status(404).json({ message: "Seeker trip not found" });
    }

    const groupsResult = await pool.query(`
      SELECT g.id, g.name, g.owner_id, g.max_size, g.status,
             t.destination, t.check_in, t.check_out, t.budget_inr,
             t.itinerary, u.name AS owner_name, u.gender AS owner_gender,
             u.gender_preference AS owner_gender_preference,
             COUNT(DISTINCT gm.user_id)::int AS member_count,
             COALESCE(array_agg(DISTINCT ui.interest_id)
               FILTER (WHERE ui.interest_id IS NOT NULL), '{}') AS owner_interests
      FROM groups g
      JOIN trips t ON t.id = g.trip_id
      JOIN users u ON u.id = g.owner_id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN user_interests ui ON ui.user_id = g.owner_id
      WHERE g.status = 'OPEN' AND t.status = 'active'
      GROUP BY g.id, t.id, u.id
    `);

    const seekerInterests = new Set(seeker.interests);
    const matches = groupsResult.rows
      .filter((group) => {
        const commonInterests = group.owner_interests.filter((interest) =>
          seekerInterests.has(interest)
        );
        const lowerBudget = Math.min(group.budget_inr, seeker.budget_inr);
        const budgetDifference = Math.abs(group.budget_inr - seeker.budget_inr);
        const enoughBudgetFit = budgetDifference <= lowerBudget * 0.4
          && group.budget_inr <= seeker.budget_inr;
        const enoughNights = nightsOverlap(
          group.check_in,
          group.check_out,
          seeker.check_in,
          seeker.check_out
        ) >= 2;
        const sameGenderAllowed =
          genderAllows(
            seeker.gender_preference,
            seeker.gender,
            group.owner_gender
          ) &&
          genderAllows(
            group.owner_gender_preference,
            group.owner_gender,
            seeker.gender
          );

        return (
          group.destination === seeker.destination &&
          enoughNights &&
          enoughBudgetFit &&
          commonInterests.length >= 2 &&
          sameGenderAllowed &&
          group.member_count + 1 <= group.max_size &&
          group.owner_id !== seeker.user_id
        );
      })
      .map((group) => ({
        ...group,
        shared_interests: group.owner_interests.filter((interest) =>
          seekerInterests.has(interest)
        ),
        overlapping_nights: nightsOverlap(
          group.check_in,
          group.check_out,
          seeker.check_in,
          seeker.check_out
        ),
      }))
      .sort((a, b) => b.shared_interests.length - a.shared_interests.length);

    res.json({ matches });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
