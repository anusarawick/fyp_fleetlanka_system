# Testing

FleetLanka has automated tests for the backend API/service layer and the React frontend. The tests are designed to run without live Supabase, Stripe, browser automation, or external network calls.

## Backend tests

Run from the repository root:

```bash
backend/.venv/bin/python -m pytest backend/tests
```

If you are not using the backend virtual environment, install `backend/requirements.txt` first.

Optional compile check:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/fleetlanka-pycache python3 -m compileall backend/app backend/tests
```

## Frontend tests

Run from the frontend folder:

```bash
cd frontend
npm run test:run
```

Build check:

```bash
npm run build
```

## What is covered

Backend coverage includes:

- health and auth guard checks
- core router behavior for vehicles, trips, documents, maintenance, service bookings, notifications, payments, and chat
- schema validation
- notification preference behavior
- maintenance sync and component-baseline updates
- ML input validation and feature-column checks

Frontend coverage includes:

- API wrapper behavior
- notification context and notification bell behavior
- chat panel behavior
- profile settings modals and password validation
- compliance page interactions
- service portal booking filters
- driver PWA trip/profile behavior

## Manual testing still needed

Some areas still need manual browser testing because they depend on real browser behavior or external services:

- responsive layout checks on desktop and mobile
- Leaflet map rendering and GPS tracking
- Supabase auth and RLS behavior with real users
- Stripe Checkout and webhook forwarding
- full manager, driver, and service-center workflow walkthroughs

Automated tests cover important behavior, but they do not replace a full QA pass with seeded data and live integrations.
