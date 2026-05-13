from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.health import router as health_router
from app.routers.drivers import router as drivers_router
from app.routers.profiles import router as profiles_router
from app.routers.trips import router as trips_router
from app.routers.fuel_logs import router as fuel_logs_router
from app.routers.maintenance import router as maintenance_router
from app.routers.documents import router as documents_router
from app.routers.service_centers import router as service_centers_router
from app.routers.service_bookings import router as service_bookings_router
from app.routers.service_portal import router as service_portal_router
from app.routers.ml import router as ml_router
from app.routers.vehicles import router as vehicles_router
from app.routers.driver_scores import router as driver_scores_router
from app.routers.saved_places import router as saved_places_router
from app.routers.payments import router as payments_router
from app.routers.chat import router as chat_router, service_router as service_chat_router
from app.routers.ai import router as ai_router
from app.routers.notifications import router as notifications_router

app = FastAPI(title="FleetLanka API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(profiles_router)
app.include_router(drivers_router)
app.include_router(vehicles_router)
app.include_router(trips_router)
app.include_router(fuel_logs_router)
app.include_router(maintenance_router)
app.include_router(documents_router)
app.include_router(service_centers_router)
app.include_router(service_bookings_router)
app.include_router(service_portal_router)
app.include_router(ml_router)
app.include_router(driver_scores_router)
app.include_router(saved_places_router)
app.include_router(payments_router)
app.include_router(chat_router)
app.include_router(service_chat_router)
app.include_router(ai_router)
app.include_router(notifications_router)
