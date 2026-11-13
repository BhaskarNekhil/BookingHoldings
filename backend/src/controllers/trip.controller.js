const service = require("../services/trip.service");
async function createTrip(req, res, next) {
  try {
    const {
      role,
      destination,
      checkIn,
      checkOut,
      budgetInr,
      interests = [],
      itinerary = null,
      genderPreference,
    } = req.body;
    if (!["creator", "seeker"].includes(role))
      return res
        .status(400)
        .json({ message: "role must be creator or seeker" });
    if (!["ANY", "SAME_GENDER"].includes(genderPreference))
      return res
        .status(400)
        .json({ message: "Choose a valid travel gender preference" });
    const trip = await service.createTrip(req.user.userId, {
      role,
      destination,
      checkIn,
      checkOut,
      budgetInr,
      interests,
      itinerary,
      genderPreference,
    });
    return res.status(201).json({ trip });
  } catch (e) {
    if (e.code === "P0001") {
      e.statusCode = 409;
      e.message =
        "You already have a trip in this time interval. Choose dates outside your existing trip to continue.";
    }
    next(e);
  }
}
async function deleteSeekerTrip(req, res, next) {
  try {
    const tripId = Number(req.params.tripId);
    if (!Number.isInteger(tripId) || tripId < 1)
      return res.status(400).json({ message: "A valid trip ID is required" });
    const result = await service.deleteSeekerTrip(tripId, req.user.userId);
    return res.json(result);
  } catch (e) {
    next(e);
  }
}
module.exports = { createTrip, deleteSeekerTrip };
