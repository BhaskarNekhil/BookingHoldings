const pool = require("../config/db");
function formatDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
async function ensureNoOppositeRoleOverlap(
  client,
  userId,
  role,
  checkIn,
  checkOut,
) {
  const existing = await client.query(
    `SELECT role,check_in::text,check_out::text FROM trips
    WHERE user_id=$1 AND role<>$2 AND status='active'
      AND daterange(check_in,check_out,'[)') && daterange($3::date,$4::date,'[)')
    ORDER BY check_in LIMIT 1`,
    [userId, role, checkIn, checkOut],
  );
  if (existing.rowCount) {
    const trip = existing.rows[0];
    const roleName = trip.role === "creator" ? "creator" : "seeker";
    const error = new Error(
      `You already have an active ${roleName} trip from ${formatDate(trip.check_in)} to ${formatDate(trip.check_out)}. Choose dates outside this trip to continue.`,
    );
    error.statusCode = 409;
    throw error;
  }
}
async function createTrip(userId, input) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const city = await client.query(
      "SELECT city FROM destinations WHERE city=$1",
      [input.destination],
    );
    if (!city.rowCount) {
      const e = new Error("Select a valid destination");
      e.statusCode = 400;
      throw e;
    }
    await ensureNoOppositeRoleOverlap(
      client,
      userId,
      input.role,
      input.checkIn,
      input.checkOut,
    );
    const result = await client.query(
      `INSERT INTO trips(user_id,role,destination,check_in,check_out,budget_inr,itinerary,gender_preference)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        userId,
        input.role,
        input.destination,
        input.checkIn,
        input.checkOut,
        input.budgetInr,
        input.itinerary,
        input.genderPreference,
      ],
    );
    for (const interest of input.interests)
      await client.query(
        "INSERT INTO trip_interests(trip_id,interest_id) VALUES($1,$2)",
        [result.rows[0].id, interest],
      );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
module.exports = { createTrip, ensureNoOppositeRoleOverlap };
