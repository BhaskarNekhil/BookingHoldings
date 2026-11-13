const express = require("express");
const path = require("node:path");
const pool = require('./config/db');
const { requireAuth } = require('./middleware/auth.middleware');
const authRoutes = require("./routes/auth.routes");
const locationRoutes = require("./routes/location.routes");
const tripRoutes = require("./routes/trip.routes");
const groupRoutes = require("./routes/group.routes");
const matchRoutes = require("./routes/match.routes");
const hotelRoutes = require("./routes/hotel.routes");
const requestRoutes = require('./routes/request.routes');
const requestLogger = require('./middleware/request-logger.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(express.json());
app.use(requestLogger);
app.use(express.static(path.join(__dirname, '../../frontend/public')));

app.get('/api/profiles/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id, name, age, gender, home_city,
      home_airport, gender_preference FROM users WHERE id=$1`, [req.params.userId]);
    if (!result.rows.length) return res.status(404).json({message:'Traveller not found'});
    const interests = await pool.query(`SELECT i.id, i.label, i.category FROM interests i
      JOIN user_interests ui ON ui.interest_id=i.id WHERE ui.user_id=$1 ORDER BY i.label`, [req.params.userId]);
    res.json({...result.rows[0], interests:interests.rows});
  } catch(e) { next(e); }
});

app.get('/api/interests', async (req, res, next) => {
  try { res.json((await pool.query('SELECT * FROM interests ORDER BY category, label')).rows); }
  catch (e) { next(e); }
});
app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const id = req.user.userId;
    const groups = await pool.query(`SELECT g.*, t.destination, t.check_in, t.check_out,
      t.budget_inr, t.itinerary, (SELECT COUNT(*)::int FROM group_members WHERE group_id=g.id) AS member_count
      FROM groups g JOIN trips t ON t.id=g.trip_id
      WHERE EXISTS (SELECT 1 FROM group_members m WHERE m.group_id=g.id AND m.user_id=$1)`, [id]);
    const trips = await pool.query("SELECT * FROM trips WHERE user_id=$1 AND role='seeker' ORDER BY id DESC", [id]);
    const requests = await pool.query(`SELECT r.*, g.name, g.owner_id, t.destination,
      to_char(t.check_in, 'YYYY-MM-DD') AS check_in,
      to_char(t.check_out, 'YYYY-MM-DD') AS check_out
      FROM join_requests r JOIN groups g ON g.id=r.group_id
      JOIN trips t ON t.id=g.trip_id WHERE r.seeker_id=$1 ORDER BY r.id DESC`, [id]);
    const incoming = await pool.query(`SELECT r.id, r.group_id, r.status, r.seeker_id,
      u.name, u.home_city FROM join_requests r
      JOIN groups g ON g.id=r.group_id JOIN users u ON u.id=r.seeker_id
      WHERE g.owner_id=$1 ORDER BY r.created_at DESC`, [id]);
    const interests = await pool.query('SELECT interest_id FROM user_interests WHERE user_id=$1', [id]);
    res.json({groups:groups.rows,trips:trips.rows,requests:requests.rows,
      incoming:incoming.rows,interests:interests.rows.map(x=>x.interest_id)});
  } catch(e) { next(e); }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/groups", groupRoutes);
app.use('/api/requests',requestRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api", hotelRoutes);

app.use(errorHandler);

module.exports = app;
