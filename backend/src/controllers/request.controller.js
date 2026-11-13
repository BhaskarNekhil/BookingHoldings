const service = require("../services/request.service");
async function create(req, res, next) {
  try {
    res
      .status(201)
      .json({
        request: await service.create(req.params.groupId, req.user.userId),
      });
  } catch (e) {
    if (e.code === "23505") e.statusCode = 409;
    next(e);
  }
}
async function list(req, res, next) {
  try {
    const group = await service.getOwner(req.params.groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.owner_id !== req.user.userId)
      return res
        .status(403)
        .json({ message: "Only group owner can view requests" });
    res.json(await service.list(req.params.groupId));
  } catch (e) {
    next(e);
  }
}
async function review(req, res, next) {
  try {
    const { status } = req.body;
    if (!["APPROVED", "REJECTED"].includes(status))
      return res
        .status(400)
        .json({ message: "status must be APPROVED or REJECTED" });
    res.json(
      await service.review(req.params.requestId, req.user.userId, status),
    );
  } catch (e) {
    next(e);
  }
}
module.exports = { create, list, review };
