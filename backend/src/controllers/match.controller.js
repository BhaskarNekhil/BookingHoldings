const service = require("../services/match.service");
const { evaluateMatch } = require("../utils/matching");

async function listMatches(req, res, next) {
  try {
    const tripId = Number(req.query.tripId);
    if (!Number.isInteger(tripId) || tripId < 1)
      return res.status(400).json({ message: "A valid tripId is required" });
    const seeker = await service.getSeekerTrip(tripId, req.user.userId);
    if (!seeker)
      return res.status(404).json({ message: "Seeker trip not found" });
    const groups = await service.getOpenGroups();
    const matches = groups
      .map((group) => ({ group, ...evaluateMatch(group, seeker) }))
      .filter((item) => item.matches)
      .map(({ matches, checks, ...item }) => ({
        ...item.group,
        shared_interests: item.shared_interests,
        overlapping_nights: item.overlapping_nights,
      }))
      .sort((a, b) => b.shared_interests.length - a.shared_interests.length);
    return res.json({ matches });
  } catch (error) {
    next(error);
  }
}

module.exports = { listMatches };
