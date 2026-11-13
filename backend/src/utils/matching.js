function nightsOverlap(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(Date.parse(aStart), Date.parse(bStart));
  const end = Math.min(Date.parse(aEnd), Date.parse(bEnd));
  return Math.max(0, Math.round((end - start) / 86400000));
}

function genderAllows(preference, ownGender, otherGender) {
  return preference === 'ANY' || ownGender === otherGender;
}

function evaluateMatch(group, seeker) {
  const shared = [...new Set(group.interests || [])]
    .filter((interest) => new Set(seeker.interests || []).has(interest));
  const lowerBudget = Math.min(Number(group.budget_inr), Number(seeker.budget_inr));
  const budgetDifference = Math.abs(Number(group.budget_inr) - Number(seeker.budget_inr));
  const nights = nightsOverlap(group.check_in, group.check_out, seeker.check_in, seeker.check_out);
  const checks = {
    sameDestination: group.destination === seeker.destination,
    dateOverlap: nights >= 2,
    budgetCompatible: budgetDifference <= lowerBudget * 0.4,
    sharedInterests: shared.length >= 2,
    mutualGenderPreference: genderAllows(seeker.gender_preference, seeker.gender, group.owner_gender)
      && genderAllows(group.owner_gender_preference, group.owner_gender, seeker.gender),
    groupHasCapacity: Number(group.member_count) + 1 <= Number(group.max_size),
    notOwnGroup: group.owner_id !== seeker.user_id,
  };
  return { matches: Object.values(checks).every(Boolean), checks, shared_interests: shared, overlapping_nights: nights };
}

module.exports = { nightsOverlap, genderAllows, evaluateMatch };
