const service = require("../services/group.service");
async function remove(req,res,next){try{res.json(await service.remove(req.params.groupId,req.user.userId));}catch(e){next(e);}}
async function leave(req,res,next){try{res.json(await service.leave(req.params.groupId,req.user.userId));}catch(e){next(e);}}
async function finalize(req,res,next){
  try {
    const {roomId}=req.body;
    if(!roomId)return res.status(400).json({message:"roomId is required"});
    res.json(await service.finalizeStay(req.params.groupId,req.user.userId,roomId));
  } catch(e) { next(e); }
}
async function recommend(req,res,next){
  try {
    const {roomId}=req.body;
    if(!roomId)return res.status(400).json({message:"roomId is required"});
    res.json(await service.setRecommendation(req.params.groupId,req.user.userId,roomId));
  } catch(e) { next(e); }
}
async function create(req, res, next) {
  try {
    const { name, destination, checkIn, checkOut, maxSize, budgetInr } =
      req.body;
    if (
      !name ||
      !destination ||
      !checkIn ||
      !checkOut ||
      !maxSize ||
      !budgetInr
    )
      return res
        .status(400)
        .json({
          message:
            "name, destination, dates, maxSize and budgetInr are required",
        });
    res.status(201).json(await service.create(req.user.userId, req.body));
  } catch (e) {
    if (e.code === "P0001") {
      e.statusCode = 409;
      e.message = "You already have a trip in this time interval. Choose dates outside your existing trip to create a group.";
    }
    next(e);
  }
}
async function requestJoin(req, res, next) {
  try {
    res
      .status(201)
      .json({
        request: await service.createJoinRequest(
          req.params.groupId,
          req.user.userId,
        ),
      });
  } catch (e) {
    if (e.code === "23505") e.statusCode = 409;
    next(e);
  }
}
async function listRequests(req, res, next) {
  try {
    const group = await service.listRequests(req.params.groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.owner_id !== req.user.userId)
      return res
        .status(403)
        .json({ message: "Only the group owner can view requests" });
    res.json(await service.requestsForGroup(req.params.groupId));
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
module.exports = { create, remove, leave, finalize, recommend, requestJoin, listRequests, review };
