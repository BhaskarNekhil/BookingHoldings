const pool = require("../config/db");
async function create(groupId, userId) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `SELECT g.id,g.owner_id,g.status,g.max_size,COUNT(gm.user_id)::int AS member_count FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 GROUP BY g.id FOR UPDATE OF g`,
      [groupId],
    );
    const g = r.rows[0];
    if (!g) {
      const e = new Error("Group not found");
      e.statusCode = 404;
      throw e;
    }
    if (g.owner_id === userId) {
      const e = new Error("Owner cannot join own group");
      e.statusCode = 400;
      throw e;
    }
    if (g.status !== "OPEN" || g.member_count >= g.max_size) {
      const e = new Error("Group has no available place");
      e.statusCode = 409;
      throw e;
    }
    const result = await c.query(
      "INSERT INTO join_requests(group_id,seeker_id) VALUES($1,$2) RETURNING id,group_id,seeker_id,status,created_at",
      [groupId, userId],
    );
    await c.query("COMMIT");
    return result.rows[0];
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function getOwner(groupId) {
  return (
    await pool.query("SELECT owner_id FROM groups WHERE id=$1", [groupId])
  ).rows[0];
}
async function list(groupId) {
  return (
    await pool.query(
      `SELECT jr.id,jr.status,jr.created_at,u.id AS seeker_id,u.name,u.age,u.gender,u.home_city,u.gender_preference FROM join_requests jr JOIN users u ON u.id=jr.seeker_id WHERE jr.group_id=$1 ORDER BY jr.created_at DESC`,
      [groupId],
    )
  ).rows;
}
async function review(requestId, userId, status) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `SELECT jr.id,jr.group_id,jr.seeker_id,jr.status,g.owner_id,g.max_size,g.status AS group_status FROM join_requests jr JOIN groups g ON g.id=jr.group_id WHERE jr.id=$1 FOR UPDATE OF g,jr`,
      [requestId],
    );
    const q = r.rows[0];
    if (!q) {
      const e = new Error("Request not found");
      e.statusCode = 404;
      throw e;
    }
    if (q.owner_id !== userId) {
      const e = new Error("Only group owner can review requests");
      e.statusCode = 403;
      throw e;
    }
    if (q.status !== "PENDING") {
      const e = new Error("Request was already reviewed");
      e.statusCode = 409;
      throw e;
    }
    if (status === "APPROVED") {
      if (q.group_status !== "OPEN") {
        const e = new Error("Group is no longer open");
        e.statusCode = 409;
        throw e;
      }
      const count = await c.query(
        "SELECT COUNT(*)::int AS count FROM group_members WHERE group_id=$1",
        [q.group_id],
      );
      if (count.rows[0].count >= q.max_size) {
        const e = new Error("Group is full");
        e.statusCode = 409;
        throw e;
      }
      await c.query(
        "INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [q.group_id, q.seeker_id],
      );
    }
    await c.query(
      "UPDATE join_requests SET status=$1,reviewed_by=$2,reviewed_at=CURRENT_TIMESTAMP WHERE id=$3",
      [status, userId, q.id],
    );
    if (status === "APPROVED") {
      const count = await c.query(
        "SELECT COUNT(*)::int AS count FROM group_members WHERE group_id=$1",
        [q.group_id],
      );
      if (count.rows[0].count >= q.max_size)
        await c.query("UPDATE groups SET status='FULL' WHERE id=$1", [
          q.group_id,
        ]);
    }
    await c.query("COMMIT");
    return { message: `Request ${status.toLowerCase()}` };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
module.exports = { create, getOwner, list, review };
