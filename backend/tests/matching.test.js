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
test("accepts identical destination even when other fields differ", () => {
  assert.equal(evaluateMatch(creatorGroup, seeker).checks.sameDestination, true);
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
test("accepts exactly two shared nights", () => {
  const twoNightGroup = { ...creatorGroup, check_in: "2027-04-14", check_out: "2027-04-17" };
  const result = evaluateMatch(twoNightGroup, seeker);
  assert.equal(result.checks.dateOverlap, true);
  assert.equal(result.overlapping_nights, 2);
});
test("treats check-out day as excluded from overlapping nights", () => {
  const adjacent = { ...creatorGroup, check_in: "2027-04-16", check_out: "2027-04-18" };
  assert.equal(evaluateMatch(adjacent, seeker).overlapping_nights, 0);
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
test("budget rule uses the lower budget as its 40 percent base", () => {
  const result = evaluateMatch(
    { ...creatorGroup, budget_inr: 60000 },
    { ...seeker, budget_inr: 85000 },
  );
  assert.equal(result.checks.budgetCompatible, false);
});
test("requires two interests shared with creator trip", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, interests: ["TEMPLES"] }, seeker).checks
      .sharedInterests,
    false,
  );
});
test("matches when exactly two interests are shared", () => {
  const result = evaluateMatch(creatorGroup, seeker);
  assert.equal(result.checks.sharedInterests, true);
  assert.equal(result.shared_interests.length, 2);
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
test("same gender is allowed when both choose same-gender preference", () => {
  assert.equal(evaluateMatch(creatorGroup, seeker).checks.mutualGenderPreference, true);
});
test("ANY preference allows either gender", () => {
  const maleSeeker = { ...seeker, gender: "MALE", gender_preference: "ANY" };
  const anyGenderGroup = { ...creatorGroup, owner_gender_preference: "ANY" };
  assert.equal(evaluateMatch(anyGenderGroup, maleSeeker).checks.mutualGenderPreference, true);
});
test("rejects gender mismatch if either side restricts companions", () => {
  const maleSeeker = { ...seeker, gender: "MALE", gender_preference: "ANY" };
  assert.equal(evaluateMatch(creatorGroup, maleSeeker).checks.mutualGenderPreference, false);
});
test("requires one available group place", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, member_count: 3, max_size: 3 }, seeker)
      .checks.groupHasCapacity,
    false,
  );
});
test("allows seeker when one remaining spot reaches max group size", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, member_count: 2, max_size: 3 }, seeker).checks.groupHasCapacity,
    true,
  );
});
test("uses total group size including the owner", () => {
  assert.equal(
    evaluateMatch({ ...creatorGroup, member_count: 3, max_size: 3 }, seeker).checks.groupHasCapacity,
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
