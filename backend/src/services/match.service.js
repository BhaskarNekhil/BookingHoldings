const pool = require("../config/db");

async function getSeekerTrip(tripId, userId) {
  const result = await pool.query(
    `SELECT t.*, u.gender, u.gender_preference,
    COALESCE(array_agg(DISTINCT ti.interest_id) FILTER (WHERE ti.interest_id IS NOT NULL), '{}') AS interests
    FROM trips t JOIN users u ON u.id=t.user_id
    LEFT JOIN trip_interests ti ON ti.trip_id=t.id
    WHERE t.id=$1 AND t.user_id=$2 AND t.role='seeker'
    GROUP BY t.id,u.gender,u.gender_preference`,
    [tripId, userId],
  );
  return result.rows[0];
}

async function getOpenGroups() {
  const result =
    await pool.query(`SELECT g.id,g.name,g.owner_id,g.max_size,g.status,
    t.destination,t.check_in,t.check_out,t.budget_inr,t.itinerary,
    u.name AS owner_name,u.gender AS owner_gender,
    u.gender_preference AS owner_gender_preference,
    COUNT(DISTINCT gm.user_id)::int AS member_count,
    COALESCE(array_agg(DISTINCT ti.interest_id) FILTER (WHERE ti.interest_id IS NOT NULL), '{}') AS interests
    FROM groups g JOIN trips t ON t.id=g.trip_id JOIN users u ON u.id=g.owner_id
    LEFT JOIN group_members gm ON gm.group_id=g.id
    LEFT JOIN trip_interests ti ON ti.trip_id=t.id
    WHERE g.status='OPEN' AND t.status='active'
    GROUP BY g.id,t.id,u.id`);
  return result.rows;
}

module.exports = { getSeekerTrip, getOpenGroups };
