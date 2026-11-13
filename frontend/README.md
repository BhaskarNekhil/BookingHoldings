# Frontend

The frontend uses plain HTML, CSS, and browser JavaScript. It needs no separate install or build step.

```text
frontend/
├── public/
│   ├── images/                 # Public hotel imagery
│   └── index.html              # App shell and asset entry points
└── src/
    ├── apis/                    # Backend API client
    ├── assets/css/              # Design tokens, layout, components, responsive styles
    ├── components/              # Shared UI such as the profile dialog
    ├── context/                 # Session and application state
    ├── hooks/                   # Shared async action behavior
    ├── pages/                   # Auth, trip planner, journeys, hotel flow
    ├── utils/                   # DOM, formatting, and form helpers
    └── main.js                  # App startup and view rendering
```

Express serves `public/` at `/` and `src/` at `/src`. The API is in `../backend/`; the frontend fetches data through those API routes. Start the app from `backend/` with `npm run dev` or `npm start`, then open `http://localhost:5000`.

Hotel recommendations, group finalization, and per-member cost splits use mock catalog data. Finalizing records the group's chosen room but does not make a real hotel reservation or payment.
