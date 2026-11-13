const service = require("../services/hotel.service");
async function list(req, res, next) {
  try {
    const c = await service.loadContext(req.params.groupId, req.user.userId);
    if (!c)
      return res
        .status(404)
        .json({ message: "Group not found or access denied" });
    const nights = Math.round(
      (Date.parse(c.check_out) - Date.parse(c.check_in)) / 86400000,
    );
    const budget = await service.loadBudget(c.id, c);
    const hotels = (await service.loadRooms(c, nights))
      .map((o) => {
        const rooms = Math.ceil(c.member_count / o.max_adults);
        const total = o.price_amount * nights * rooms;
        return {
          ...o,
          rooms_required: rooms,
          total_cost_inr: total,
          cost_per_member_inr: Math.ceil(total / c.member_count),
          available: o.minimum_rooms_left >= rooms,
        };
      })
      .filter((h) => h.available && h.cost_per_member_inr <= budget);
    res.json({
      group_id: c.id,
      destination: c.destination,
      check_in: c.check_in,
      check_out: c.check_out,
      member_count: c.member_count,
      budget_limit_inr: budget,
      hotels,
    });
  } catch (e) {
    next(e);
  }
}
module.exports = { list };
