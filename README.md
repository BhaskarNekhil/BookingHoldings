# roamTogether — Group Travel Matcher

Find travel companions with compatible destinations, dates, budgets, interests, and gender preferences. Group creators can review requests, compare hotel options, recommend a room, and record a cost split.

## Quick start

Prerequisites: Node.js, PostgreSQL, and a local `BookingHoldings` database with the schema and seed data already loaded. Configure `backend/.env` first (see `backend/.env.example`).

From the project root, run these two commands in PowerShell:

```powershell
cd backend
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). The Express server serves both the API and the frontend. Check [http://localhost:5000/health](http://localhost:5000/health) to confirm the server is responding.

### First-time database setup

Create the `BookingHoldings` database in PostgreSQL, configure `backend/.env`, then run from the project root:

```powershell
cd backend
npm install
npm run db:schema
npm run db:seed
npm run dev
```

The seed command needs the supplied JSON data pack at `hackathon-problem-3-group-travel-matcher/data`. That data directory is intentionally excluded from Git. Seeded demo accounts use the password `Password@123`; their email is the lowercase traveller ID followed by `@seed.local` (for example, `t-001@seed.local`).

## Automated tests

Unit tests run without PostgreSQL. API integration tests send HTTP requests to Express and verify the seeded JSON-backed accounts, destinations, group matching, requests, hotel recommendations, and stay finalization against PostgreSQL. They are guarded to run only against a database named exactly `BookingHoldings_test`.

Create that separate database in PostgreSQL, then from `backend/`:

```powershell
Copy-Item .env.test.example .env.test
# Edit .env.test with your local PostgreSQL credentials.
$env:DOTENV_CONFIG_PATH = ".env.test"
npm run db:schema
npm run db:seed
npm run test:unit
npm run test:integration
```

Run both test suites with `npm test`. Without `backend/.env.test`, the integration suite is skipped. Failed API cases print the test name and assertion/error in the terminal. Keep `.env.test` local; it is Git-ignored.

## Architecture

- **Frontend:** Plain HTML, CSS, and browser JavaScript, served by Express. `frontend/public` contains the app shell and public images; `frontend/src` is organized into API client, assets, components, context, hooks, pages, utilities, and startup code.
- **Backend:** Node.js and Express. Routes map endpoints, controllers handle request logic, and services perform PostgreSQL queries through the `pg` connection pool.
- **Database:** PostgreSQL schema and seed runner live in `backend/src/database`. The schema stores users, interests, destinations, trips, groups, requests, hotel catalog data, recommendations, finalized stays, and member expenses.
- **Request flow:** Authentication and idempotency middleware protect write endpoints; database transactions and row locks protect group request and finalization updates.

## Implemented

- Password-based signup and login, traveller profiles, and profile viewing.
- Creator groups and seeker trips, including trip-specific gender preference.
- Fuzzy and full-text destination search using PostgreSQL `pg_trgm` and `tsvector`.
- Matching by same city, at least two overlapping nights, budget compatibility, shared interests, mutual gender preference, and group capacity.
- Join requests with pending, approved, and rejected states; created and joined trip views; group deletion and leaving a group.
- Hotel and room search/comparison, group room recommendations, stay finalization, and per-member expense splits.
- API request/error logging that avoids logging user profile or password data.

## Known limitations

- Hotel, room, and availability details come from the supplied demo catalog. Finalizing a stay records the group’s choice and cost split; it does not reserve a room or collect payment.
- Destination search and seeding depend on the supplied JSON data pack, which is not included in the Git repository.
- The app is configured for local development; production deployment, payment processing, and real hotel-provider integration are not included.
