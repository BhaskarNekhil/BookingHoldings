const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateMatch } = require("../src/utils/matching");

const seeker = {
  user_id: "S",
  destination: "Kyoto",
  check_in: "2027-04-09",
  check_out: "2027-04-16",
  budget_inr: 62000,
  interests: ["TEMPLES", "STREET_FOOD", "ADVENTURE"],
  gender: "FEMALE",
  gender_preference: "SAME_GENDER",
};
const creatorGroup = {
  owner_id: "C",
  destination: "Kyoto",
  check_in: "2027-04-10",
  check_out: "2027-04-15",
  budget_inr: 60000,
  interests: ["TEMPLES", "STREET_FOOD", "PHOTOGRAPHY"],
  owner_gender: "FEMALE",
  owner_gender_preference: "SAME_GENDER",
  member_count: 1,
  max_size: 3,
};

test("accepts problem statement example with five shared nights", () => {
  const result = evaluateMatch(creatorGroup, seeker);
  assert.equal(result.matches, true);
  assert.equal(result.overlapping_nights, 5);
  assert.deepEqual(result.shared_interests, ["TEMPLES", "STREET_FOOD"]);
});
test("requires same exact destination city", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, destination: "Osaka" }, seeker).checks
      .sameDestination,
    false,
  );
});
test("requires at least two overlapping nights", () => {
  assert.equal(
    evaluateMatch(
      { ...creatorGroup, check_in: "2027-04-15", check_out: "2027-04-18" },
      seeker,
    ).checks.dateOverlap,
    false,
  );
});
test("accepts 40 percent budget boundary and rejects above it", () => {
  const budgetSeeker = { ...seeker, budget_inr: 60000 };
  assert.equal(
    evaluateMatch({ ...creatorGroup, budget_inr: 84000 }, budgetSeeker).checks
      .budgetCompatible,
    true,
  );
  assert.equal(
    evaluateMatch({ ...creatorGroup, budget_inr: 85000 }, budgetSeeker).checks
      .budgetCompatible,
    false,
  );
});
test("requires two interests shared with creator trip", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, interests: ["TEMPLES"] }, seeker).checks
      .sharedInterests,
    false,
  );
});
test("checks gender preferences mutually", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, owner_gender: "MALE" }, seeker).checks
      .mutualGenderPreference,
    false,
  );
  assert.equal(
    evaluateMatch({ ...creatorGroup, owner_gender_preference: "ANY" }, seeker)
      .checks.mutualGenderPreference,
    true,
  );
});
test("requires one available group place", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, member_count: 3, max_size: 3 }, seeker)
      .checks.groupHasCapacity,
    false,
  );
});
test("does not recommend a users own group", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, owner_id: "S" }, seeker).checks
      .notOwnGroup,
    false,
  );
});
