# Frontend

The frontend is implemented in plain HTML, CSS and JavaScript. Static hotel images are available under
`public/images/`, matching the `images/hotels/...` paths in the catalog.

The Express API lives in `../backend/` and shared JSON data in
`../hackathon-problem-3-group-travel-matcher/data/`.
Fetch application data through the backend API.

Run `npm start` from `../backend`, then open http://localhost:5000.
Express serves `public/` directly, so no separate frontend install or build is needed.
Includes signup/login, destination autocomplete, creator/seeker forms, matching,
saved searches, group requests and hotel comparison. The stay confirmation is a
demo popup only: it does not create a real or persisted booking.
