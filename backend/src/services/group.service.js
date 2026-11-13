const crypto = require("node:crypto");
const pool = require("../config/db");
const { ensureNoOppositeRoleOverlap } = require("./trip.service");
async function create(userId, input) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await ensureNoOppositeRoleOverlap(
      c,
      userId,
      "creator",
      input.checkIn,
      input.checkOut,
    );
    const t = await c.query(
      `INSERT INTO trips(user_id,role,destination,check_in,check_out,budget_inr,itinerary) VALUES($1,'creator',$2,$3,$4,$5,$6) RETURNING id`,
      [
        userId,
        input.destination,
        input.checkIn,
        input.checkOut,
        input.budgetInr,
        input.itinerary || null,
      ],
    );
    const id = `G-${crypto.randomUUID()}`;
    await c.query(
      "INSERT INTO groups(id,trip_id,owner_id,name,max_size) VALUES($1,$2,$3,$4,$5)",
      [id, t.rows[0].id, userId, input.name, input.maxSize],
    );
    await c.query("INSERT INTO group_members(group_id,user_id) VALUES($1,$2)", [
      id,
      userId,
    ]);
    await c.query("INSERT INTO group_finalization_status(group_id) VALUES($1)", [id]);
    for (const interest of input.interests || [])
      await c.query(
        "INSERT INTO trip_interests(trip_id,interest_id) VALUES($1,$2)",
        [t.rows[0].id, interest],
      );
    await c.query("COMMIT");
    return { groupId: id, tripId: t.rows[0].id };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function remove(groupId, userId) {
  const result = await pool.query(
    "DELETE FROM groups WHERE id=$1 AND owner_id=$2 RETURNING id",
    [groupId, userId],
  );
  if (!result.rowCount) {
    const e = new Error("Group not found or you are not its creator");
    e.statusCode = 404;
    throw e;
  }
  return { message: "Group deleted" };
}
async function leave(groupId, userId) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const group = await c.query("SELECT owner_id FROM groups WHERE id=$1 FOR UPDATE", [groupId]);
    if (!group.rowCount) {
      const e = new Error("Group not found"); e.statusCode = 404; throw e;
    }
    if (group.rows[0].owner_id === userId) {
      const e = new Error("The group creator cannot leave their own group; delete it instead"); e.statusCode = 409; throw e;
    }
    const finalization = await c.query("SELECT status FROM group_finalization_status WHERE group_id=$1", [groupId]);
    if (finalization.rows[0]?.status === "finalized") {
      const e = new Error("This group's stay is finalized, so members can no longer leave"); e.statusCode = 409; throw e;
    }
    await c.query("DELETE FROM group_members WHERE group_id=$1 AND user_id=$2", [groupId, userId]);
    const request = await c.query(
      `UPDATE join_requests SET status='CANCELLED',reviewed_at=CURRENT_TIMESTAMP
       WHERE group_id=$1 AND seeker_id=$2 AND status IN ('PENDING','APPROVED') RETURNING id`,
      [groupId, userId],
    );
    if (!request.rowCount) {
      const e = new Error("You do not have a request or membership in this group"); e.statusCode = 404; throw e;
    }
    const remaining = await c.query("SELECT COUNT(*)::int AS count FROM group_members WHERE group_id=$1", [groupId]);
    await c.query("UPDATE groups SET status='OPEN' WHERE id=$1 AND status='FULL' AND $2 < max_size", [groupId, remaining.rows[0].count]);
    await c.query("COMMIT");
    return { message: "You left the group" };
  } catch (e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
async function finalizeStay(groupId, userId, roomId) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const groupResult = await c.query(
      `SELECT g.id,g.owner_id,g.status,t.destination,t.check_in,t.check_out,t.budget_inr
       FROM groups g JOIN trips t ON t.id=g.trip_id WHERE g.id=$1 FOR UPDATE OF g`, [groupId]);
    const g = groupResult.rows[0];
    if (!g) { const e = new Error("Group not found"); e.statusCode=404; throw e; }
    if (g.owner_id !== userId) { const e = new Error("Only the group creator can finalize the stay"); e.statusCode=403; throw e; }
    if (g.status === "CLOSED") { const e = new Error("This group has already been finalized"); e.statusCode=409; throw e; }
    const members = await c.query("SELECT COUNT(*)::int AS count FROM group_members WHERE group_id=$1", [groupId]);
    g.member_count = members.rows[0].count;
    if (g.member_count < 2) { const e = new Error("At least one traveller must be accepted before finalizing the stay"); e.statusCode=409; throw e; }
    const roomResult = await c.query(
      `SELECT r.id AS room_id,r.hotel_id,r.max_adults,r.price_amount,h.city
       FROM rooms r JOIN hotels h ON h.id=r.hotel_id WHERE r.id=$1`, [roomId]);
    const room = roomResult.rows[0];
    if (!room || room.city !== g.destination) { const e = new Error("That room is not available in the group's destination"); e.statusCode=400; throw e; }
    const nights = Math.round((Date.parse(g.check_out)-Date.parse(g.check_in))/86400000);
    const roomCount = Math.ceil(g.member_count / room.max_adults);
    const availability = await c.query(
      `SELECT stay_date,rooms_left FROM availability WHERE room_id=$1 AND stay_date >= $2 AND stay_date < $3
       ORDER BY stay_date FOR UPDATE`, [roomId,g.check_in,g.check_out]);
    if (availability.rowCount !== nights || availability.rows.some(x=>x.rooms_left < roomCount)) {
      const e = new Error("There are not enough rooms available for every night of this group's stay"); e.statusCode=409; throw e;
    }
    const totalCost = room.price_amount * nights * roomCount;
    const budgetResult = await c.query(
      `SELECT MIN(s.budget_inr)::int AS lowest_budget FROM group_members m
       JOIN trips s ON s.user_id=m.user_id AND s.role='seeker' AND s.status='active'
       WHERE m.group_id=$1 AND s.destination=$2 AND s.check_in<$4 AND s.check_out>$3`,
      [groupId,g.destination,g.check_in,g.check_out]);
    const budgetLimit = Math.min(g.budget_inr,budgetResult.rows[0].lowest_budget ?? g.budget_inr);
    const perMember = Math.ceil(totalCost/g.member_count);
    if (perMember > budgetLimit) { const e = new Error(`This stay costs ${perMember} per person, above the group budget of ${budgetLimit}`); e.statusCode=409; throw e; }
    await c.query(
      `INSERT INTO finalized_stays(group_id,hotel_id,room_id,check_in,check_out,room_count,total_cost_inr,cost_per_member_inr,finalized_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [groupId,room.hotel_id,roomId,g.check_in,g.check_out,roomCount,totalCost,perMember,userId]);
    await c.query(
      `INSERT INTO group_finalization_status(group_id,status) VALUES($1,'finalized')
       ON CONFLICT (group_id) DO UPDATE SET status='finalized',updated_at=CURRENT_TIMESTAMP`, [groupId]);
    await c.query(
      `INSERT INTO group_room_recommendations(group_id,room_id,recommended_by) VALUES($1,$2,$3)
       ON CONFLICT (group_id) DO UPDATE SET room_id=EXCLUDED.room_id,recommended_by=EXCLUDED.recommended_by,updated_at=CURRENT_TIMESTAMP`,
      [groupId,roomId,userId]);
    await c.query(
      `INSERT INTO group_member_expenses(group_id,user_id,expenditure_inr)
       SELECT $1,user_id,($2::integer / $3::integer) + CASE
         WHEN row_number() OVER (ORDER BY user_id) <= ($2::integer % $3::integer) THEN 1 ELSE 0 END
       FROM group_members WHERE group_id=$1`, [groupId,totalCost,g.member_count]);
    await c.query("UPDATE groups SET status='CLOSED' WHERE id=$1", [groupId]);
    await c.query(
      "UPDATE join_requests SET status='CANCELLED',reviewed_at=CURRENT_TIMESTAMP WHERE group_id=$1 AND status='PENDING'",
      [groupId],
    );
    const expenseRows = await c.query(
      `SELECT e.group_id,e.user_id,u.name,e.expenditure_inr FROM group_member_expenses e
       JOIN users u ON u.id=e.user_id WHERE e.group_id=$1 ORDER BY u.name`, [groupId]);
    await c.query("COMMIT");
    return { message:"Group stay finalized. No hotel reservation or payment was made.", groupId, roomId, roomCount, memberCount:g.member_count, totalCostInr:totalCost, costPerPersonInr:perMember, checkIn:g.check_in, checkOut:g.check_out, expenses:expenseRows.rows };
  } catch(e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
async function setRecommendation(groupId,userId,roomId) {
  const c=await pool.connect();
  try {
    await c.query("BEGIN");
    const group=(await c.query(`SELECT g.owner_id,g.status,t.destination FROM groups g
      JOIN trips t ON t.id=g.trip_id WHERE g.id=$1 FOR UPDATE OF g`,[groupId])).rows[0];
    if(!group){const e=new Error("Group not found");e.statusCode=404;throw e;}
    if(group.owner_id!==userId){const e=new Error("Only the group creator can recommend a room");e.statusCode=403;throw e;}
    if(group.status==='CLOSED'){const e=new Error("This group's stay is already finalized");e.statusCode=409;throw e;}
    const room=(await c.query("SELECT r.id,h.city FROM rooms r JOIN hotels h ON h.id=r.hotel_id WHERE r.id=$1",[roomId])).rows[0];
    if(!room||room.city!==group.destination){const e=new Error("Choose a room in the group's destination");e.statusCode=400;throw e;}
    await c.query(`INSERT INTO group_room_recommendations(group_id,room_id,recommended_by) VALUES($1,$2,$3)
      ON CONFLICT (group_id) DO UPDATE SET room_id=EXCLUDED.room_id,recommended_by=EXCLUDED.recommended_by,updated_at=CURRENT_TIMESTAMP`,[groupId,roomId,userId]);
    await c.query("COMMIT");
    return {message:"Room recommendation saved",groupId,roomId};
  } catch(e){await c.query("ROLLBACK");throw e;}
  finally{c.release();}
}
async function createJoinRequest(groupId, userId) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `SELECT id,owner_id,status,max_size FROM groups WHERE id=$1 FOR UPDATE`,
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
    const memberCount = await c.query(
      "SELECT COUNT(*)::int AS member_count FROM group_members WHERE group_id=$1",
      [groupId],
    );
    g.member_count = memberCount.rows[0].member_count;
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
async function listRequests(groupId) {
  return (
    await pool.query("SELECT owner_id FROM groups WHERE id=$1", [groupId])
  ).rows[0];
}
async function requestsForGroup(groupId) {
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
      const e = new Error("Only the group owner can review requests");
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
module.exports = {
  create,
  remove,
  leave,
  finalizeStay,
  setRecommendation,
  createJoinRequest,
  listRequests,
  requestsForGroup,
  review,
};
