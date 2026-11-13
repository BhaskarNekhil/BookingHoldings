# API test matrix

Cases below use the supplied seed JSON records (travellers T-001 through T-024, groups G-01 through G-12, destination and hotel catalogs). Seeded login format is `<traveller_id lowercase>@seed.local`; the seed password is `Password@123`.

## Execution status

The automated HTTP integration suite is `backend/tests/api.integration.test.js`; it logs in using the seeded traveller JSON and covers signup/login, destinations, profiles, trips, matching, group requests, hotel recommendations, and finalization. Run it against the isolated test database with `npm run test:integration`.

The 80 rows below remain the broader expected-behavior checklist (10 cases per route/API area). `BLOCKED` means the case has not been individually measured against the local PostgreSQL database. In this environment the database connection returned `EACCES`, so no live API result is claimed. The suite's output reports each automated test's name and any failing assertion/error.

## Auth — `/api/auth`

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| AU-01 | Login as T-001 using `t-001@seed.local` / `Password@123` | 200; Sarah Thomas and JWT returned | BLOCKED |
| AU-02 | Login as T-002 using `t-002@seed.local` / `Password@123` | 200; Priya Shah and JWT returned | BLOCKED |
| AU-03 | Login as T-024 using `t-024@seed.local` / `Password@123` | 200; Aditya Rao and JWT returned | BLOCKED |
| AU-04 | Login with T-001 email and incorrect password | 401; generic invalid credentials message | BLOCKED |
| AU-05 | Login with an email not present in travellers JSON | 401; invalid credentials | BLOCKED |
| AU-06 | Login with missing email | 401; no token issued | BLOCKED |
| AU-07 | Login with missing password | 401; no token issued | BLOCKED |
| AU-08 | Signup with T-002's already-seeded email | 409; duplicate email message | BLOCKED |
| AU-09 | Signup with a new email and valid identity fields based on a traveller record | 201; user and token returned, password hash omitted | BLOCKED |
| AU-10 | Signup with missing email, name, password, or gender (one field omitted per request) | 400 for each missing required field | BLOCKED |

## Trips — `POST /api/trips`

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| TR-01 | Authenticated T-002 creates a seeker trip: Kyoto, 10–15 Apr 2027, ₹62,000, two interests | 201; seeker trip returned with selected values | BLOCKED |
| TR-02 | Create trip with role `admin` | 400; invalid role | BLOCKED |
| TR-03 | Create trip with gender preference `MALE_ONLY` | 400; invalid preference | BLOCKED |
| TR-04 | Create trip with unknown destination `Kyotox` | 400; destination must be selected from catalog | BLOCKED |
| TR-05 | Create trip without a bearer token | 401; authentication required | BLOCKED |
| TR-06 | T-001 creates a seeker trip overlapping Sarah's seeded creator trip (10–15 Apr) | 409; conflicting interval explained | BLOCKED |
| TR-07 | Create an opposite-role trip starting on the creator trip's checkout date | 201 if all other fields are valid; checkout is exclusive | BLOCKED |
| TR-08 | Create trip with checkout before check-in | 400 validation response expected; currently may surface as a database constraint error | BLOCKED |
| TR-09 | Create trip with zero/negative budget | 400 validation response expected; currently may surface as a database constraint error | BLOCKED |
| TR-10 | Create trip with an unknown interest ID | 400 validation response expected; currently may surface as a foreign-key error | BLOCKED |

## Groups — `/api/groups`

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| GR-01 | Authenticated user creates a Kyoto group with valid dates, budget, interests, gender preference, and size | 201; group created with creator as first member | BLOCKED |
| GR-02 | Create group without a name | 400; required fields message | BLOCKED |
| GR-03 | Create group without gender preference | 400; valid preference required | BLOCKED |
| GR-04 | T-001 creates a group overlapping Sarah's existing seeded creator trip | 409; conflicting interval message | BLOCKED |
| GR-05 | Create a group using a non-catalog destination | 4xx validation expected; currently may surface as a foreign-key error | BLOCKED |
| GR-06 | Delete G-01 as Sarah (T-001) | 200; group and dependent records removed | BLOCKED |
| GR-07 | Delete G-01 as non-owner Priya (T-002) | 404/authorization error; group remains | BLOCKED |
| GR-08 | Delete a nonexistent group ID | 404; not found | BLOCKED |
| GR-09 | Finalize G-01 without `roomId` | 400; `roomId` required | BLOCKED |
| GR-10 | Recommend a room outside the group's destination or finalize as a non-owner | 400 for wrong-destination room / 403 for non-owner; no state change | BLOCKED |

## Requests — `/api/requests` (and equivalent group request routes)

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| RQ-01 | Priya (T-002) requests to join open G-01 | 201; request status `PENDING` | BLOCKED |
| RQ-02 | Sarah (T-001) requests to join her own G-01 | 400; owner cannot join own group | BLOCKED |
| RQ-03 | Request to a nonexistent group | 404; group not found | BLOCKED |
| RQ-04 | Priya submits the same active G-01 request twice | First 201; second 409; only one active request | BLOCKED |
| RQ-05 | Sarah lists G-01 requests | 200; includes Priya's pending request | BLOCKED |
| RQ-06 | Priya tries to list G-01 requests | 403; only owner may view incoming requests | BLOCKED |
| RQ-07 | Sarah approves Priya's pending request | 200; request `APPROVED`, Priya added to members | BLOCKED |
| RQ-08 | Sarah rejects a pending request | 200; request `REJECTED`, member count unchanged | BLOCKED |
| RQ-09 | Review a request with unsupported status `WAITING` | 400; only `APPROVED` or `REJECTED` accepted | BLOCKED |
| RQ-10 | Approve an already reviewed request or review as a non-owner | 409 for already reviewed / 403 for non-owner; no unintended membership change | BLOCKED |

## Matching — `GET /api/matches?tripId=...`

Use Priya's T-002 profile/interests and a saved Kyoto seeker trip (10–15 Apr 2027, ₹62,000). Match interests are taken from the saved seeker trip and each group owner's seeded profile interests.

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| MA-01 | Priya seeks Kyoto, 10–15 Apr, ₹62,000; interests include TEMPLES and STREET_FOOD | Sarah's G-01 is a match (5 shared nights) | BLOCKED |
| MA-02 | Search with a trip ID not owned by Priya | 404; seeker trip not found | BLOCKED |
| MA-03 | Search without a valid `tripId` | 400; valid trip ID required | BLOCKED |
| MA-04 | Change seeker destination to Osaka | Kyoto groups, including G-01, do not match | BLOCKED |
| MA-05 | Dates overlap only one night | Group does not match | BLOCKED |
| MA-06 | Dates overlap exactly two nights | Group passes date rule if other criteria pass | BLOCKED |
| MA-07 | Budget pair ₹60,000 and ₹84,000 | Passes exact 40% threshold | BLOCKED |
| MA-08 | Budget pair ₹60,000 and ₹84,001 | Fails budget rule | BLOCKED |
| MA-09 | Only one shared interest with the owner | Group does not match | BLOCKED |
| MA-10 | Female-only/same-gender restriction conflicts, or group is full | Group does not match | BLOCKED |

## Locations — `GET /api/locations/search?q=...`

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| LO-01 | Search `Kyoto` | Kyoto appears in results | BLOCKED |
| LO-02 | Search typo `Kyot` | Fuzzy search returns Kyoto | BLOCKED |
| LO-03 | Search `Osaka` | Osaka appears in results | BLOCKED |
| LO-04 | Search `Tokyo` | Tokyo appears in results | BLOCKED |
| LO-05 | Search `Dubai` | Dubai appears in results | BLOCKED |
| LO-06 | Search `Abu Dhabi` | Abu Dhabi appears in results | BLOCKED |
| LO-07 | Search one-character query `K` | Empty array; queries shorter than two characters are ignored | BLOCKED |
| LO-08 | Search a phrase with surrounding spaces, e.g. ` Kyoto ` | Results are trimmed and Kyoto is returned | BLOCKED |
| LO-09 | Search an unrelated city not in the destination catalog | Empty array | BLOCKED |
| LO-10 | Search a country/partial text from destination JSON | Matching city/country rows returned, max 10 | BLOCKED |

## Hotels — `GET /api/groups/:groupId/hotels`

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| HT-01 | Sarah loads hotel options for G-01 (Kyoto, 10–15 Apr) | 200; Kyoto options filtered by dates, rooms, and budget | BLOCKED |
| HT-02 | Priya loads G-01 hotels before approval | 404/access denied; only group members can view | BLOCKED |
| HT-03 | Priya loads G-01 hotels after approval | 200; group stay options visible | BLOCKED |
| HT-04 | Authenticated member requests hotels for nonexistent group | 404; group not found/access denied | BLOCKED |
| HT-05 | Request without token | 401; authentication required | BLOCKED |
| HT-06 | Every returned hotel is in the group's destination city | True for Kyoto group | BLOCKED |
| HT-07 | Every returned room has availability for every stay night | True for each returned option | BLOCKED |
| HT-08 | Returned per-person cost exceeds the smallest member/group budget | Such option is excluded | BLOCKED |
| HT-09 | Creator recommends a room in Kyoto | 200; current recommendation is returned to members | BLOCKED |
| HT-10 | Finalized group loads hotels again | Finalized stay and per-member expense split returned; no booking/payment created | BLOCKED |

## Shared app endpoints — health, interests, profiles, dashboard

| ID | Test data / action | Expected | Status |
|---|---|---|---|
| SH-01 | `GET /health` | 200 with `{ "status": "ok" }` | BLOCKED |
| SH-02 | `GET /api/interests` | 200; catalog agrees with `problem-3/interests.json` | BLOCKED |
| SH-03 | `GET /api/dashboard` with Priya's token | 200; groups, trips, requests, incoming, and interests arrays returned | BLOCKED |
| SH-04 | `GET /api/dashboard` without token | 401 | BLOCKED |
| SH-05 | Sarah reads Priya's profile using `GET /api/profiles/T-002` | 200; profile and seeded interests returned | BLOCKED |
| SH-06 | Authenticated request for nonexistent profile ID | 404; traveller not found | BLOCKED |
| SH-07 | Profile request without token | 401 | BLOCKED |
| SH-08 | Dashboard group rows for Priya after approval | Include accepted group and membership | BLOCKED |
| SH-09 | Dashboard pending request for Priya | Includes group name, destination, and `PENDING` status | BLOCKED |
| SH-10 | Dashboard after finalization | Shows finalized hotel/room and the user's expenditure | BLOCKED |

## Run locally

Create and seed a dedicated `BookingHoldings_test` database, then create `backend/.env.test` from `.env.test.example`. From `backend/`, run:

```powershell
npm run test:unit
npm run test:integration
```

`npm test` runs both suites; the integration suite skips if `.env.test` is absent and refuses any database name other than `BookingHoldings_test`. The integration tests create temporary test users/groups and clean them up. Continue using the disposable database for group deletion and finalization cases.
