const pool = require("../config/db");
async function loadContext(groupId, userId) {
  const r = await pool.query(
    `SELECT g.id,g.owner_id,g.status,t.destination,t.check_in,t.check_out,t.budget_inr,COUNT(gm.user_id)::int AS member_count FROM groups g JOIN trips t ON t.id=g.trip_id JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 AND EXISTS(SELECT 1 FROM group_members mine WHERE mine.group_id=g.id AND mine.user_id=$2) GROUP BY g.id,t.id`,
    [groupId, userId],
  );
  return r.rows[0];
}
async function loadFinalizedStay(groupId) {
  const r=await pool.query(`SELECT fs.*,h.name AS hotel_name,r.name AS room_name
    FROM finalized_stays fs JOIN hotels h ON h.id=fs.hotel_id JOIN rooms r ON r.id=fs.room_id WHERE fs.group_id=$1`,[groupId]);
  return r.rows[0]||null;
}
async function loadFinalizationStatus(groupId) {
  const r=await pool.query("SELECT status FROM group_finalization_status WHERE group_id=$1",[groupId]);
  return r.rows[0]?.status || "unfinalized";
}
async function loadMemberExpenses(groupId) {
  const r=await pool.query(`SELECT e.group_id,e.user_id,u.name,e.expenditure_inr
    FROM group_member_expenses e JOIN users u ON u.id=e.user_id
    WHERE e.group_id=$1 ORDER BY u.name`,[groupId]);
  return r.rows;
}
async function loadRecommendation(groupId) {
  const r=await pool.query(`SELECT gr.room_id,gr.recommended_by,u.name AS recommended_by_name,
      h.name AS hotel_name,ro.name AS room_name,gr.updated_at
    FROM group_room_recommendations gr JOIN rooms ro ON ro.id=gr.room_id
    JOIN hotels h ON h.id=ro.hotel_id JOIN users u ON u.id=gr.recommended_by
    WHERE gr.group_id=$1`,[groupId]);
  return r.rows[0]||null;
}
async function loadBudget(groupId, c) {
  const r = await pool.query(
    `SELECT MIN(s.budget_inr)::int AS lowest_budget FROM group_members m JOIN trips s ON s.user_id=m.user_id WHERE m.group_id=$1 AND s.role='seeker' AND s.status='active' AND s.destination=$2 AND s.check_in<$4 AND s.check_out>$3`,
    [groupId, c.destination, c.check_in, c.check_out],
  );
  return Math.min(c.budget_inr, r.rows[0].lowest_budget ?? c.budget_inr);
}
async function loadRooms(c, nights) {
  const r = await pool.query(
    `SELECT h.id AS hotel_id,h.name AS hotel_name,h.city,h.area,h.rating,h.stars,h.image,r.id AS room_id,r.name AS room_name,r.room_type,r.max_adults,r.max_children,r.price_amount,r.currency,r.refundable,MIN(a.rooms_left)::int AS minimum_rooms_left,COUNT(a.stay_date)::int AS available_nights FROM hotels h JOIN rooms r ON r.hotel_id=h.id JOIN availability a ON a.room_id=r.id AND a.stay_date >= $2 AND a.stay_date < $3 WHERE h.city=$1 GROUP BY h.id,r.id HAVING COUNT(a.stay_date)=$4 ORDER BY h.rating DESC,r.price_amount ASC`,
    [c.destination, c.check_in, c.check_out, nights],
  );
  return r.rows;
}
module.exports = { loadContext, loadBudget, loadRooms, loadFinalizedStay, loadFinalizationStatus, loadMemberExpenses, loadRecommendation };
