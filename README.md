# FleetLanka: Machine Learning Based Fleet Management System with Predictive Maintenance and Fuel Analytics for Sri Lankan SMEs

FleetLanka is a fleet management system built for a final-year project. It supports daily fleet operations for small and medium businesses, with predictive maintenance and fuel analytics added on top of the core workflow.

The application has three user-facing areas:

- **Manager portal** for fleet records, trips, drivers, maintenance, documents, reports, and analytics.
- **Driver PWA** for assigned trips, trip history, fuel logs, and profile updates.
- **Service-center portal** for booking confirmation, job completion, maintenance details, and approval-based sync.

## Main features

- Vehicle and driver management
- Trip assignment, live trip tracking, and saved places
- Fuel logs, fuel analytics, and 7-day fuel forecasting
- Maintenance records and service-center bookings
- Predictive maintenance risk checks and prediction history
- Compliance document tracking
- Notifications and chat between managers and service centers
- Stripe test-mode payment flow for service bookings

## Tech stack

- **Frontend:** React, Vite, TypeScript
- **Driver mobile app:** PWA inside the same frontend
- **Backend:** FastAPI
- **Database, auth, storage:** Supabase
- **Maps:** Leaflet, OpenStreetMap, optional OpenRouteService route previews
- **Machine learning:** scikit-learn, pandas, imbalanced-learn
- **Payments:** Stripe Connect test mode
- **Local development:** Docker Compose

## Project structure

```text
frontend/          React application for manager, driver, and service-center users
backend/           FastAPI API, service layer, and ML scripts
backend/app/ml/    Model training, validation, feature builders, and model files
supabase/          Database schema and migrations
```

At runtime, the React app talks to the FastAPI API. The API uses Supabase for auth, database access, and storage. ML inference runs in the backend using saved model artifacts under `backend/app/ml/models/`.

## Local setup

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in the required Supabase values:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8000
```

Optional values:

```bash
OPENROUTESERVICE_API_KEY=       # road-following route previews
STRIPE_SECRET_KEY=              # service-booking payments
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECTED_ACCOUNT_COUNTRY=AU
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=                 # AI assistant features
```

Start the local stack:

```bash
docker compose up --build
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

## Useful commands

Frontend commands:

```bash
cd frontend
npm run dev
npm run build
npm run test:run
```

Backend test command:

```bash
backend/.venv/bin/python -m pytest backend/tests
```

If using a system Python instead of the backend virtual environment, make sure the backend dependencies are installed first.

## ML notes

The current ML work includes predictive maintenance classification and fuel forecasting. The shared weekly feature-builder version used by the newer training path is:

```text
fleetlanka_weekly_features_v1
```

More details are in `backend/app/ml/README.md`.

## Payments and webhooks

Stripe is used in test mode for service-center payments. For local webhook testing:

```bash
stripe listen --forward-to localhost:8000/payments/stripe/webhook
```

The application can run without Stripe values, but payment-related actions require the Stripe environment variables.

Must download dataset and the model files from here

https://liveplymouthac-my.sharepoint.com/:f:/g/personal/10953682_students_plymouth_ac_uk/IgDDGwmpw4JjTZtGDHMlCWFnAfK0EHGjcHMt5TChI4PCPwQ?e=erV8sP
