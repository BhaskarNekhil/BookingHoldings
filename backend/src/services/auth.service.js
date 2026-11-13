const pool = require("../config/db");
async function createUser(user, passwordHash, input) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `INSERT INTO users(id,email,name,password_hash,age,gender,home_city,home_airport,gender_preference) VALUES($1,LOWER($2),$3,$4,$5,$6,$7,$8,$9) RETURNING id,email,name,age,gender,home_city,home_airport,gender_preference`,
      [
        user.id,
        user.email,
        user.name,
        passwordHash,
        user.age || null,
        user.gender,
        user.homeCity || null,
        user.homeAirport || null,
        user.genderPreference || "ANY",
      ],
    );
    for (const interest of input.interests || [])
      await c.query(
        "INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [user.id, interest],
      );
    await c.query("COMMIT");
    return r.rows[0];
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function findByEmail(email) {
  return (
    await pool.query(
      "SELECT id,email,name,password_hash,age,gender,home_city,home_airport,gender_preference FROM users WHERE email=LOWER($1)",
      [email],
    )
  ).rows[0];
}
module.exports = { createUser, findByEmail };
