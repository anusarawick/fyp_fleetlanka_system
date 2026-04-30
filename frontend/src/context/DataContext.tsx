import {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useMemo,
    ReactNode,
    FormEvent,
} from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";
import { useAuth } from "./AuthContext";
import {
    Vehicle,
    Driver,
    Trip,
    FuelLog,
    FuelForecast,
    Maintenance,
    Document,
    ServiceCenter,
    ServiceBooking,
    DriverScore,
    Alert,
    MaintenancePrediction,
    LiveTrip,
} from "../types";

type DataContextType = {
    // Entity state
    vehicles: Vehicle[];
    drivers: Driver[];
    trips: Trip[];
    liveTrips: LiveTrip[];
    fuelLogs: FuelLog[];
    maintenance: Maintenance[];
    documents: Document[];
    serviceCenters: ServiceCenter[];
    serviceBookings: ServiceBooking[];
    driverScores: DriverScore[];
    maintenancePredictions: MaintenancePrediction[];
    fuelForecasts: FuelForecast[];

    // Computed values
    activeTrips: number;
    fuelCostTotal: number;
    currency: Intl.NumberFormat;
    geoSupported: boolean;
    upcomingDocs: Document[];
    driverScore: number;
    driverScoreLabel: "Excellent" | "Good" | "Average" | "Needs work";
    driverScoreBreakdown: {
        speed: number;
        idle: number;
        distance: number;
        consistency: number;
    };
    topPerformers: Array<{ driverId: string; driverName: string; score: number }>;

    // Vehicle form state
    plateNo: string;
    setPlateNo: (v: string) => void;
    make: string;
    setMake: (v: string) => void;
    model: string;
    setModel: (v: string) => void;
    vehicleType: string;
    setVehicleType: (v: string) => void;
    year: string;
    setYear: (v: string) => void;
    vehicleStatus: string;
    setVehicleStatus: (v: string) => void;
    vehicleMileage: string;
    setVehicleMileage: (v: string) => void;
    vehicleOdometer: string;
    setVehicleOdometer: (v: string) => void;
    transmissionType: string;
    setTransmissionType: (v: string) => void;
    engineSizeCc: string;
    setEngineSizeCc: (v: string) => void;
    accidentHistoryCount: string;
    setAccidentHistoryCount: (v: string) => void;
    fuelEfficiency: string;
    setFuelEfficiency: (v: string) => void;
    maintenanceHistory: string;
    setMaintenanceHistory: (v: string) => void;
    reportedIssuesCount: string;
    setReportedIssuesCount: (v: string) => void;
    tireCondition: string;
    setTireCondition: (v: string) => void;
    brakeCondition: string;
    setBrakeCondition: (v: string) => void;
    batteryStatus: string;
    setBatteryStatus: (v: string) => void;
    editingVehicleId: string | null;

    // Driver form state
    driverName: string;
    setDriverName: (v: string) => void;
    driverEmail: string;
    setDriverEmail: (v: string) => void;
    driverPhone: string;
    setDriverPhone: (v: string) => void;
    driverStatus: string;
    setDriverStatus: (v: string) => void;
    driverPassword: string;
    setDriverPassword: (v: string) => void;
    editingDriverId: string | null;

    // Trip state
    selectedVehicle: string;
    setSelectedVehicle: (v: string) => void;
    activeTripId: string | null;
    tripTrackingStatus: "inactive" | "tracking" | "stale" | "error";
    tripTrackingLastUpdated: string | null;
    pendingTripSyncCount: number;
    pendingGpsPointCount: number;
    syncingTripQueue: boolean;
    pendingTripStatusById: Record<string, "pending_start" | "pending_completion" | "sync_failed">;

    // Fuel form state
    fuelVehicle: string;
    setFuelVehicle: (v: string) => void;
    fuelDate: string;
    setFuelDate: (v: string) => void;
    fuelLiters: string;
    setFuelLiters: (v: string) => void;
    fuelCost: string;
    setFuelCost: (v: string) => void;
    fuelOdometer: string;
    setFuelOdometer: (v: string) => void;
    fuelVendor: string;
    setFuelVendor: (v: string) => void;
    editingFuelId: string | null;

    // Maintenance form state
    maintVehicle: string;
    setMaintVehicle: (v: string) => void;
    maintDate: string;
    setMaintDate: (v: string) => void;
    maintType: string;
    setMaintType: (v: string) => void;
    maintCost: string;
    setMaintCost: (v: string) => void;
    maintOdometer: string;
    setMaintOdometer: (v: string) => void;
    maintNextDue: string;
    setMaintNextDue: (v: string) => void;
    maintNotes: string;
    setMaintNotes: (v: string) => void;
    editingMaintenanceId: string | null;

    // Document form state
    docOwnerType: "vehicle" | "driver";
    setDocOwnerType: (v: "vehicle" | "driver") => void;
    docVehicle: string;
    setDocVehicle: (v: string) => void;
    docDriver: string;
    setDocDriver: (v: string) => void;
    docType: string;
    setDocType: (v: string) => void;
    docNumber: string;
    setDocNumber: (v: string) => void;
    docExpiry: string;
    setDocExpiry: (v: string) => void;
    editingDocumentId: string | null;

    // Service center form state
    centerName: string;
    setCenterName: (v: string) => void;
    centerPhone: string;
    setCenterPhone: (v: string) => void;
    centerAddress: string;
    setCenterAddress: (v: string) => void;
    centerPortalEmail: string;
    setCenterPortalEmail: (v: string) => void;
    centerPortalPassword: string;
    setCenterPortalPassword: (v: string) => void;
    editingCenterId: string | null;

    // Booking form state
    bookingVehicle: string;
    setBookingVehicle: (v: string) => void;
    bookingCenter: string;
    setBookingCenter: (v: string) => void;
    bookingDate: string;
    setBookingDate: (v: string) => void;
    bookingNotes: string;
    setBookingNotes: (v: string) => void;
    editingBookingId: string | null;

    // ML state
    maintFeatures: string;
    setMaintFeatures: (v: string) => void;
    fuelFeatures: string;
    setFuelFeatures: (v: string) => void;
    mlVehicleId: string;
    setMlVehicleId: (v: string) => void;
    maintResult: string | null;
    fuelResult: string | null;
    maintenancePredictionMap: Record<string, MaintenancePrediction>;
    refreshFuelForecasts: () => Promise<void>;

    // Handlers
    handleSaveVehicle: (e: FormEvent) => Promise<void>;
    handleEditVehicle: (vehicle: Vehicle) => void;
    handleCancelVehicleEdit: () => void;
    handleDeleteVehicle: (vehicleId: string) => Promise<void>;
    handleSaveDriver: (e: FormEvent) => Promise<void>;
    handleEditDriver: (driver: Driver) => void;
    handleCancelDriverEdit: () => void;
    handleDeleteDriver: (driverId: string) => Promise<void>;
    startTrip: (tripId?: string) => Promise<void>;
    stopTrip: () => Promise<void>;
    handleCreateTripAssignment: (payload: {
        vehicle_id: string;
        driver_id: string;
        trip_title?: string;
        scheduled_start?: string;
        origin_label?: string;
        destination_label?: string;
        origin_lat?: number;
        origin_lon?: number;
        destination_lat?: number;
        destination_lon?: number;
        contact_name?: string;
        contact_phone?: string;
        priority?: string;
        notes?: string;
        status?: string;
    }) => Promise<void>;
    handleUpdateTripAssignment: (
        tripId: string,
        payload: {
            vehicle_id?: string;
            driver_id?: string;
            trip_title?: string;
            scheduled_start?: string;
            origin_label?: string;
            destination_label?: string;
            origin_lat?: number;
            origin_lon?: number;
            destination_lat?: number;
            destination_lon?: number;
            contact_name?: string;
            contact_phone?: string;
            priority?: string;
            notes?: string;
            status?: string;
        }
    ) => Promise<void>;
    handleDeleteTripRecord: (tripId: string) => Promise<void>;
    handleAddFuel: (e: FormEvent) => Promise<void>;
    handleEditFuel: (fuelLog: FuelLog) => void;
    handleCancelFuelEdit: () => void;
    handleDeleteFuel: (fuelId: string) => Promise<void>;
    handleAddMaintenance: (e: FormEvent) => Promise<void>;
    handleEditMaintenance: (record: Maintenance) => void;
    handleCancelMaintenanceEdit: () => void;
    handleDeleteMaintenance: (maintenanceId: string) => Promise<void>;
    handleAddDocument: (e: FormEvent) => Promise<void>;
    handleEditDocument: (document: Document) => void;
    handleCancelDocumentEdit: () => void;
    handleDeleteDocument: (documentId: string) => Promise<void>;
    handleAddCenter: (e: FormEvent) => Promise<void>;
    handleEditCenter: (center: ServiceCenter) => void;
    handleCancelCenterEdit: () => void;
    handleDeleteCenter: (centerId: string) => Promise<void>;
    handleAddBooking: (e: FormEvent) => Promise<void>;
    handleEditBooking: (booking: ServiceBooking) => void;
    handleCancelBookingEdit: () => void;
    handleDeleteBooking: (bookingId: string) => Promise<void>;
    handleApproveBookingCompletion: (bookingId: string) => Promise<void>;
    handleRejectBookingCompletion: (bookingId: string, note: string) => Promise<void>;
    handlePredictMaintenance: (e: FormEvent) => Promise<void>;
    handlePredictFuel: (e: FormEvent) => Promise<void>;
    runVehicleMaintenanceCheck: (vehicleId: string) => Promise<void>;
    buildAlerts: () => Alert[];

    // Reset on logout
    resetData: () => void;
};

const DataContext = createContext<DataContextType | null>(null);

type OfflineGpsPoint = {
    trip_id: string;
    recorded_at: string;
    lat: number;
    lon: number;
    speed_kmh: number | null;
};

type PendingTripEvent = {
    trip_id: string;
    type: "start" | "end";
    event_time: string;
    created_at: string;
    point?: OfflineGpsPoint;
    error?: string;
};

type PendingGpsPoint = {
    temp_id: string;
    payload: OfflineGpsPoint;
};

const DRIVER_PENDING_TRIPS_KEY = "fleetlanka.driver.pendingTrips.v1";
const DRIVER_PENDING_GPS_POINTS_KEY = "fleetlanka.driver.pendingGpsPoints.v1";

function readLocalStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch {
        return fallback;
    }
}

function writeLocalStorage<T>(key: string, value: T) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
}

function removeLocalStorage(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
}

function buildGpsPointFromPosition(tripId: string, pos: GeolocationPosition): OfflineGpsPoint {
    return {
        trip_id: tripId,
        recorded_at: new Date(pos.timestamp).toISOString(),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        speed_kmh: pos.coords.speed ? Number((pos.coords.speed * 3.6).toFixed(2)) : null,
    };
}

function applyPendingTripEventsToTrips(rows: Trip[], events: PendingTripEvent[]): Trip[] {
    if (!events.length) return rows;
    return rows.map((trip) => {
        const tripEvents = events.filter((event) => event.trip_id === trip.id);
        if (!tripEvents.length) return trip;
        const startEvent = tripEvents.find((event) => event.type === "start");
        const endEvent = tripEvents.find((event) => event.type === "end");
        return {
            ...trip,
            status: endEvent ? "completed" : startEvent ? "in_progress" : trip.status,
            start_time: startEvent?.event_time || trip.start_time,
            start_lat: startEvent?.point?.lat ?? trip.start_lat,
            start_lon: startEvent?.point?.lon ?? trip.start_lon,
            end_time: endEvent?.event_time || trip.end_time,
            end_lat: endEvent?.point?.lat ?? trip.end_lat,
            end_lon: endEvent?.point?.lon ?? trip.end_lon,
        };
    });
}

export function DataProvider({ children }: { children: ReactNode }) {
    const { token, orgId, role, fullName, setError, setLoading, loading } = useAuth();

    // Entity state
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [liveTrips, setLiveTrips] = useState<LiveTrip[]>([]);
    const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
    const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
    const [serviceBookings, setServiceBookings] = useState<ServiceBooking[]>([]);
    const [driverScores, setDriverScores] = useState<DriverScore[]>([]);
    const [maintenancePredictions, setMaintenancePredictions] = useState<MaintenancePrediction[]>([]);
    const [fuelForecasts, setFuelForecasts] = useState<FuelForecast[]>([]);

    const deriveTripStatus = (trip: Trip) => {
        if (trip.status) return trip.status;
        if (trip.end_time) return "completed";
        if (trip.start_time) return "in_progress";
        return "assigned";
    };

    // Vehicle form
    const [plateNo, setPlateNo] = useState("");
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [vehicleType, setVehicleType] = useState("");
    const [year, setYear] = useState("");
    const [vehicleStatus, setVehicleStatus] = useState("active");
    const [vehicleMileage, setVehicleMileage] = useState("");
    const [vehicleOdometer, setVehicleOdometer] = useState("");
    const [transmissionType, setTransmissionType] = useState("");
    const [engineSizeCc, setEngineSizeCc] = useState("");
    const [accidentHistoryCount, setAccidentHistoryCount] = useState("0");
    const [fuelEfficiency, setFuelEfficiency] = useState("");
    const [maintenanceHistory, setMaintenanceHistory] = useState("");
    const [reportedIssuesCount, setReportedIssuesCount] = useState("0");
    const [tireCondition, setTireCondition] = useState("");
    const [brakeCondition, setBrakeCondition] = useState("");
    const [batteryStatus, setBatteryStatus] = useState("");
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

    // Driver form
    const [driverName, setDriverName] = useState("");
    const [driverEmail, setDriverEmail] = useState("");
    const [driverPhone, setDriverPhone] = useState("");
    const [driverStatus, setDriverStatus] = useState("active");
    const [driverPassword, setDriverPassword] = useState("");
    const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

    // Trip state
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [tripTrackingStatus, setTripTrackingStatus] = useState<"inactive" | "tracking" | "stale" | "error">("inactive");
    const [tripTrackingLastUpdated, setTripTrackingLastUpdated] = useState<string | null>(null);
    const [pendingTripEvents, setPendingTripEvents] = useState<PendingTripEvent[]>(() =>
        readLocalStorage<PendingTripEvent[]>(DRIVER_PENDING_TRIPS_KEY, [])
    );
    const [pendingGpsPoints, setPendingGpsPoints] = useState<PendingGpsPoint[]>(() =>
        readLocalStorage<PendingGpsPoint[]>(DRIVER_PENDING_GPS_POINTS_KEY, [])
    );
    const [syncingTripQueue, setSyncingTripQueue] = useState(false);
    const [driverOnline, setDriverOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
    const watchIdRef = useRef<number | null>(null);
    const lastSavedScoreSignatureRef = useRef<string>("");
    const pendingTripStatusRef = useRef<Record<string, "pending_start" | "pending_completion" | "sync_failed">>({});
    const lastTripSyncFailureSignatureRef = useRef<string>("");
    const syncingTripQueueRef = useRef(false);

    // Fuel form
    const [fuelVehicle, setFuelVehicle] = useState("");
    const [fuelDate, setFuelDate] = useState("");
    const [fuelLiters, setFuelLiters] = useState("");
    const [fuelCost, setFuelCost] = useState("");
    const [fuelOdometer, setFuelOdometer] = useState("");
    const [fuelVendor, setFuelVendor] = useState("");
    const [editingFuelId, setEditingFuelId] = useState<string | null>(null);

    // Maintenance form
    const [maintVehicle, setMaintVehicle] = useState("");
    const [maintDate, setMaintDate] = useState("");
    const [maintType, setMaintType] = useState("");
    const [maintCost, setMaintCost] = useState("");
    const [maintOdometer, setMaintOdometer] = useState("");
    const [maintNextDue, setMaintNextDue] = useState("");
    const [maintNotes, setMaintNotes] = useState("");
    const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);

    // Document form
    const [docOwnerType, setDocOwnerType] = useState<"vehicle" | "driver">("vehicle");
    const [docVehicle, setDocVehicle] = useState("");
    const [docDriver, setDocDriver] = useState("");
    const [docType, setDocType] = useState("");
    const [docNumber, setDocNumber] = useState("");
    const [docExpiry, setDocExpiry] = useState("");
    const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

    // Service center form
    const [centerName, setCenterName] = useState("");
    const [centerPhone, setCenterPhone] = useState("");
    const [centerAddress, setCenterAddress] = useState("");
    const [centerPortalEmail, setCenterPortalEmail] = useState("");
    const [centerPortalPassword, setCenterPortalPassword] = useState("");
    const [editingCenterId, setEditingCenterId] = useState<string | null>(null);

    // Booking form
    const [bookingVehicle, setBookingVehicle] = useState("");
    const [bookingCenter, setBookingCenter] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [bookingNotes, setBookingNotes] = useState("");
    const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

    const pendingTripStatusById = useMemo(() => {
        const statusMap: Record<string, "pending_start" | "pending_completion" | "sync_failed"> = {};
        for (const event of pendingTripEvents) {
            if (event.error) {
                statusMap[event.trip_id] = "sync_failed";
            } else if (event.type === "end") {
                statusMap[event.trip_id] = "pending_completion";
            } else if (!statusMap[event.trip_id]) {
                statusMap[event.trip_id] = "pending_start";
            }
        }
        return statusMap;
    }, [pendingTripEvents]);

    useEffect(() => {
        pendingTripStatusRef.current = pendingTripStatusById;
    }, [pendingTripStatusById]);

    // ML state
    const [maintFeatures, setMaintFeatures] = useState("");
    const [fuelFeatures, setFuelFeatures] = useState("");
    const [mlVehicleId, setMlVehicleId] = useState("");
    const [maintResult, setMaintResult] = useState<string | null>(null);
    const [fuelResult, setFuelResult] = useState<string | null>(null);

    // Computed
    const geoSupported = useMemo(() => "geolocation" in navigator, []);
    const currency = useMemo(
        () =>
            new Intl.NumberFormat("en-LK", {
                style: "currency",
                currency: "LKR",
                maximumFractionDigits: 0,
            }),
        []
    );
    const activeTrips = trips.filter((t) => deriveTripStatus(t) === "in_progress").length;
    const fuelCostTotal = fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);

    const upcomingDocs = documents.filter((d) => {
        if (!d.expiry_date) return false;
        const date = new Date(d.expiry_date).getTime();
        const now = new Date().getTime();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        return date >= now && date <= now + fourteenDays;
    });

    const completedTrips = useMemo(() => trips.filter((t) => !!t.end_time), [trips]);

    const driverScoreBreakdown = useMemo(() => {
        if (completedTrips.length === 0) {
            return { speed: 70, idle: 70, distance: 70, consistency: 70 };
        }

        const avg = (arr: number[]) =>
            arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : 0;

        const avgSpeedValues = completedTrips
            .map((t) => t.avg_speed_kmh)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

        const speedScores = avgSpeedValues.map((speed) => {
            if (speed >= 40 && speed <= 80) return 100;
            if (speed < 40) return Math.max(0, 100 - (40 - speed) * 2.5);
            return Math.max(0, 100 - (speed - 80) * 3.5);
        });
        const speedScore = speedScores.length ? avg(speedScores) : 70;

        const idleRatios = completedTrips
            .map((t) => {
                const idle = t.idle_min;
                const duration = t.duration_min;
                if (
                    typeof idle !== "number" ||
                    typeof duration !== "number" ||
                    !Number.isFinite(idle) ||
                    !Number.isFinite(duration) ||
                    duration <= 0
                ) {
                    return null;
                }
                return idle / duration;
            })
            .filter((ratio): ratio is number => ratio !== null);
        const idleScores = idleRatios.map((ratio) => {
            if (ratio <= 0.1) return 100;
            if (ratio >= 0.5) return 0;
            return Math.max(0, 100 - ((ratio - 0.1) / 0.4) * 100);
        });
        const idleScore = idleScores.length ? avg(idleScores) : 70;

        const distanceEfficiency = completedTrips
            .map((t) => {
                const distance = t.distance_km;
                const duration = t.duration_min;
                if (
                    typeof distance !== "number" ||
                    typeof duration !== "number" ||
                    !Number.isFinite(distance) ||
                    !Number.isFinite(duration) ||
                    distance <= 0 ||
                    duration <= 0
                ) {
                    return null;
                }
                const derivedSpeed = (distance / duration) * 60;
                if (derivedSpeed >= 30 && derivedSpeed <= 75) return 100;
                if (derivedSpeed < 30) return Math.max(0, 100 - (30 - derivedSpeed) * 2.5);
                return Math.max(0, 100 - (derivedSpeed - 75) * 3.0);
            })
            .filter((score): score is number => score !== null);
        const distanceScore = distanceEfficiency.length ? avg(distanceEfficiency) : 70;

        const durationValues = completedTrips
            .map((t) => t.duration_min)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
        let consistencyScore = 70;
        if (durationValues.length >= 2) {
            const meanDuration = avg(durationValues);
            const variance =
                durationValues.reduce((sum, value) => sum + (value - meanDuration) ** 2, 0) /
                durationValues.length;
            const stdDev = Math.sqrt(variance);
            const cv = stdDev / meanDuration;
            consistencyScore = Math.max(0, Math.min(100, 100 - cv * 120));
        }

        const weighted =
            speedScore * 0.35 +
            idleScore * 0.25 +
            distanceScore * 0.2 +
            consistencyScore * 0.2;
        return {
            speed: Math.round(Math.max(0, Math.min(100, speedScore))),
            idle: Math.round(Math.max(0, Math.min(100, idleScore))),
            distance: Math.round(Math.max(0, Math.min(100, distanceScore))),
            consistency: Math.round(Math.max(0, Math.min(100, consistencyScore))),
        };
    }, [completedTrips]);

    const driverScore = useMemo(() => {
        const weighted =
            driverScoreBreakdown.speed * 0.35 +
            driverScoreBreakdown.idle * 0.25 +
            driverScoreBreakdown.distance * 0.2 +
            driverScoreBreakdown.consistency * 0.2;
        return Math.round(Math.max(0, Math.min(100, weighted)));
    }, [driverScoreBreakdown]);

    const driverScoreLabel: "Excellent" | "Good" | "Average" | "Needs work" =
        driverScore >= 85
            ? "Excellent"
            : driverScore >= 70
                ? "Good"
                : driverScore >= 55
                    ? "Average"
                    : "Needs work";

    const topPerformers = useMemo(() => {
        const latestByDriver = new Map<string, DriverScore>();
        for (const row of driverScores) {
            if (!latestByDriver.has(row.driver_id)) {
                latestByDriver.set(row.driver_id, row);
            }
        }
        return Array.from(latestByDriver.values())
            .map((row) => ({
                driverId: row.driver_id,
                driverName: row.driver_name || "Driver",
                score: row.overall_score,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }, [driverScores]);

    const maintenancePredictionMap = useMemo(() => {
        const latestByVehicle: Record<string, MaintenancePrediction> = {};
        for (const prediction of maintenancePredictions) {
            if (!latestByVehicle[prediction.vehicle_id]) {
                latestByVehicle[prediction.vehicle_id] = prediction;
            }
        }
        return latestByVehicle;
    }, [maintenancePredictions]);

    useEffect(() => {
        if (!token || role !== "driver") return;
        if (completedTrips.length === 0) return;

        const lastTrip = completedTrips[0];
        const signature = [
            completedTrips.length,
            lastTrip?.id || "",
            lastTrip?.end_time || "",
            driverScore,
            driverScoreBreakdown.speed,
            driverScoreBreakdown.idle,
            driverScoreBreakdown.distance,
            driverScoreBreakdown.consistency,
        ].join("|");

        if (lastSavedScoreSignatureRef.current === signature) return;
        lastSavedScoreSignatureRef.current = signature;

        apiPost<DriverScore>(
            "/driver-scores/me",
            {
                overall_score: driverScore,
                speed_score: driverScoreBreakdown.speed,
                idle_score: driverScoreBreakdown.idle,
                distance_score: driverScoreBreakdown.distance,
                consistency_score: driverScoreBreakdown.consistency,
            },
            token
        )
            .then((saved) => {
                setDriverScores((prev) => [saved, ...prev].slice(0, 200));
            })
            .catch(() => {
                // Keep app flow uninterrupted if snapshot save fails.
            });
    }, [token, role, completedTrips, driverScore, driverScoreBreakdown]);

    useEffect(() => {
        if (role !== "driver" || !activeTripId || !tripTrackingLastUpdated) return;
        const updateStatus = () => {
            const ageMs = Date.now() - new Date(tripTrackingLastUpdated).getTime();
            setTripTrackingStatus(ageMs > 2 * 60 * 1000 ? "stale" : "tracking");
        };
        updateStatus();
        const intervalId = window.setInterval(updateStatus, 15000);
        return () => window.clearInterval(intervalId);
    }, [role, activeTripId, tripTrackingLastUpdated]);

    useEffect(() => {
        function handleOnline() {
            lastTripSyncFailureSignatureRef.current = "";
            setDriverOnline(true);
        }
        function handleOffline() {
            lastTripSyncFailureSignatureRef.current = "";
            setDriverOnline(false);
        }
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    useEffect(() => {
        if (pendingTripEvents.length) {
            writeLocalStorage(DRIVER_PENDING_TRIPS_KEY, pendingTripEvents);
        } else {
            removeLocalStorage(DRIVER_PENDING_TRIPS_KEY);
        }
    }, [pendingTripEvents]);

    useEffect(() => {
        if (pendingGpsPoints.length) {
            writeLocalStorage(DRIVER_PENDING_GPS_POINTS_KEY, pendingGpsPoints);
        } else {
            removeLocalStorage(DRIVER_PENDING_GPS_POINTS_KEY);
        }
    }, [pendingGpsPoints]);

    useEffect(() => {
        if (
            !token ||
            role !== "driver" ||
            !driverOnline ||
            syncingTripQueueRef.current ||
            (!pendingTripEvents.length && !pendingGpsPoints.length)
        ) {
            return;
        }

        let cancelled = false;
        const eventsSnapshot = pendingTripEvents;
        const gpsSnapshot = pendingGpsPoints;
        const syncSignature = JSON.stringify({
            events: eventsSnapshot.map((event) => [event.trip_id, event.type, event.event_time]),
            points: gpsSnapshot.map((point) => [point.temp_id, point.payload.recorded_at]),
        });
        if (lastTripSyncFailureSignatureRef.current === syncSignature) return;

        async function syncTripQueue() {
            syncingTripQueueRef.current = true;
            setSyncingTripQueue(true);
            const serverTrips = await apiGet<Trip[]>("/trips", token);
            const serverTripMap = new Map(serverTrips.map((trip) => [trip.id, trip]));
            const tripIds = Array.from(new Set([
                ...eventsSnapshot.map((event) => event.trip_id),
                ...gpsSnapshot.map((point) => point.payload.trip_id),
            ]));

            try {
                for (const tripId of tripIds) {
                    if (cancelled) return;
                    setPendingTripEvents((prev) => prev.map((event) =>
                        event.trip_id === tripId ? { ...event, error: undefined } : event
                    ));

                    const startEvent = eventsSnapshot.find((event) => event.trip_id === tripId && event.type === "start");
                    const endEvent = eventsSnapshot.find((event) => event.trip_id === tripId && event.type === "end");
                    let serverTrip = serverTripMap.get(tripId) || null;
                    let serverStatus = serverTrip ? deriveTripStatus(serverTrip) : "";
                    const tripGpsPoints = gpsSnapshot
                        .filter((point) => point.payload.trip_id === tripId)
                        .sort((a, b) => a.payload.recorded_at.localeCompare(b.payload.recorded_at));

                    try {
                        if (!serverTrip) {
                            throw new Error("Trip was not found on the server");
                        }

                        if (serverStatus === "cancelled") {
                            throw new Error("Trip was cancelled before offline changes could sync");
                        }

                        if (startEvent) {
                            if (serverStatus === "assigned") {
                                serverTrip = await apiPatch<Trip>(
                                    `/trips/${tripId}`,
                                    {
                                        status: "in_progress",
                                        start_time: startEvent.event_time,
                                        start_lat: startEvent.point?.lat,
                                        start_lon: startEvent.point?.lon,
                                    },
                                    token
                                );
                                serverTripMap.set(tripId, serverTrip);
                                serverStatus = deriveTripStatus(serverTrip);
                                if (cancelled) return;
                                setTrips((prev) => prev.map((trip) => trip.id === serverTrip?.id ? serverTrip as Trip : trip));
                            }
                            setPendingTripEvents((prev) => prev.filter((event) => !(event.trip_id === tripId && event.type === "start")));
                        }

                        if (endEvent && serverStatus === "assigned") {
                            const syntheticStartTime = startEvent?.event_time || endEvent.event_time;
                            serverTrip = await apiPatch<Trip>(
                                `/trips/${tripId}`,
                                {
                                    status: "in_progress",
                                    start_time: syntheticStartTime,
                                    start_lat: startEvent?.point?.lat ?? endEvent.point?.lat,
                                    start_lon: startEvent?.point?.lon ?? endEvent.point?.lon,
                                },
                                token
                            );
                            serverTripMap.set(tripId, serverTrip);
                            serverStatus = deriveTripStatus(serverTrip);
                            if (cancelled) return;
                            setTrips((prev) => prev.map((trip) => trip.id === serverTrip?.id ? serverTrip as Trip : trip));
                        }

                        if (serverStatus === "completed") {
                            setPendingGpsPoints((prev) => prev.filter((item) => item.payload.trip_id !== tripId));
                            setPendingTripEvents((prev) => prev.filter((event) => event.trip_id !== tripId));
                            continue;
                        }

                        if (serverStatus !== "in_progress") {
                            throw new Error("Trip is not available for offline sync");
                        }

                        for (const point of tripGpsPoints) {
                            if (cancelled) return;
                            await apiPost(`/trips/${tripId}/points`, point.payload, token);
                            setPendingGpsPoints((prev) => prev.filter((item) => item.temp_id !== point.temp_id));
                        }

                        if (endEvent) {
                            serverTrip = await apiPatch<Trip>(
                                    `/trips/${tripId}`,
                                    {
                                        status: "completed",
                                        end_time: endEvent.event_time,
                                        end_lat: endEvent.point?.lat,
                                        end_lon: endEvent.point?.lon,
                                    },
                                    token
                                );
                            if (cancelled) return;
                            serverTripMap.set(tripId, serverTrip);
                            setTrips((prev) => prev.map((trip) => trip.id === serverTrip?.id ? serverTrip as Trip : trip));
                            setPendingTripEvents((prev) => prev.filter((event) => !(event.trip_id === tripId && event.type === "end")));
                            setActiveTripId((current) => current === tripId ? null : current);
                            setTripTrackingStatus((current) => current === "tracking" ? "inactive" : current);
                            setTripTrackingLastUpdated(null);
                        }
                    } catch (err: any) {
                        const message = err.message || "Trip sync failed. It will retry when connected.";
                        lastTripSyncFailureSignatureRef.current = syncSignature;
                        setPendingTripEvents((prev) => prev.map((event) =>
                            event.trip_id === tripId ? { ...event, error: message } : event
                        ));
                        setError(message);
                        return;
                    }
                }

                if (!cancelled) {
                    const refreshedTrips = await apiGet<Trip[]>("/trips", token);
                    setTrips(refreshedTrips);
                    const activeTrip = refreshedTrips.find((trip) => deriveTripStatus(trip) === "in_progress") || null;
                    setActiveTripId(activeTrip?.id || null);
                }
            } finally {
                syncingTripQueueRef.current = false;
                if (!cancelled) setSyncingTripQueue(false);
            }
        }

        syncTripQueue();
        return () => {
            cancelled = true;
        };
    }, [token, role, driverOnline, pendingTripEvents, pendingGpsPoints, setError]);

    // Data loading
    useEffect(() => {
        if (!token || !role) return;
        const load = async () => {
            try {
                if (role === "driver") {
                    const [v, t] = await Promise.all([
                        apiGet<Vehicle[]>("/vehicles", token),
                        apiGet<Trip[]>("/trips", token),
                    ]);
                    const displayTrips = applyPendingTripEventsToTrips(t, pendingTripEvents);
                    setVehicles(v);
                    setTrips(displayTrips);
                    const activeTrip = displayTrips.find((trip) => deriveTripStatus(trip) === "in_progress") || null;
                    setActiveTripId(activeTrip?.id || null);
                    setTripTrackingStatus(activeTrip ? "stale" : "inactive");
                    setTripTrackingLastUpdated(null);
                    setDrivers([]);
                    setFuelLogs([]);
                    setMaintenance([]);
                    setDocuments([]);
                    setServiceCenters([]);
                    setServiceBookings([]);
                    setDriverScores([]);
                    setMaintenancePredictions([]);
                    setFuelForecasts([]);
                    setLiveTrips([]);
                    setMlVehicleId("");
                    return;
                }
                if (role === "service") {
                    setVehicles([]);
                    setDrivers([]);
                    setTrips([]);
                    setFuelLogs([]);
                    setMaintenance([]);
                    setDocuments([]);
                    setServiceCenters([]);
                    setServiceBookings([]);
                    setDriverScores([]);
                    setMaintenancePredictions([]);
                    setFuelForecasts([]);
                    setLiveTrips([]);
                    setMlVehicleId("");
                    return;
                }

                const [v, d, t, f, m, doc, sc, sb, ds, mp] = await Promise.all([
                    apiGet<Vehicle[]>("/vehicles", token),
                    apiGet<Driver[]>("/drivers", token),
                    apiGet<Trip[]>("/trips", token),
                    apiGet<FuelLog[]>("/fuel-logs", token),
                    apiGet<Maintenance[]>("/maintenance", token),
                    apiGet<Document[]>("/documents", token),
                    apiGet<ServiceCenter[]>("/service-centers", token),
                    apiGet<ServiceBooking[]>("/service-bookings", token),
                    apiGet<DriverScore[]>("/driver-scores", token),
                    apiGet<MaintenancePrediction[]>("/ml/maintenance/predictions", token),
                ]);
                setVehicles(v);
                setDrivers(d);
                setTrips(t);
                setFuelLogs(f);
                setMaintenance(m);
                setDocuments(doc);
                setServiceCenters(sc);
                setServiceBookings(sb);
                setDriverScores(ds);
                setMaintenancePredictions(mp);
                setFuelForecasts([]);
                setLiveTrips([]);
            } catch (e: any) {
                setError(e.message);
            }
        };
        load();
    }, [token, role]);

    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!token || role !== "manager") return;
        let cancelled = false;
        let intervalId: number | null = null;

        const loadLiveTrips = async () => {
            try {
                const rows = await apiGet<LiveTrip[]>("/trips/live", token);
                if (!cancelled) {
                    setLiveTrips(rows);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setLiveTrips([]);
                    setError(err.message || "Failed to load live trips");
                }
            }
        };

        loadLiveTrips();
        intervalId = window.setInterval(loadLiveTrips, 15000);

        return () => {
            cancelled = true;
            if (intervalId !== null) window.clearInterval(intervalId);
        };
    }, [token, role, setError]);

    async function refreshFuelForecasts() {
        if (!token || role !== "manager") return;
        const response = await apiGet<{ forecasts: FuelForecast[] }>("/ml/fuel/forecast", token);
        setFuelForecasts(response.forecasts || []);
    }

    useEffect(() => {
        if (!token || role !== "manager") return;
        refreshFuelForecasts().catch((err: any) => {
            setFuelForecasts([]);
            setError(err.message || "Fuel forecast load failed");
        });
    }, [token, role, vehicles.length, fuelLogs.length, trips.length]);

    useEffect(() => {
        if (role !== "driver" || !token || !activeTripId || watchIdRef.current !== null) return;
        if (!geoSupported) {
            setTripTrackingStatus("error");
            return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const point = buildGpsPointFromPosition(activeTripId, pos);
                const pointTime = point.recorded_at;
                const shouldQueuePoint = !navigator.onLine || Boolean(pendingTripStatusRef.current[activeTripId]);
                if (shouldQueuePoint) {
                    setPendingGpsPoints((prev) => [
                        ...prev,
                        { temp_id: `offline-gps-${activeTripId}-${pointTime}`, payload: point },
                    ]);
                    setTripTrackingLastUpdated(pointTime);
                    setTripTrackingStatus(navigator.onLine ? "stale" : "tracking");
                    return;
                }
                try {
                    await apiPost(`/trips/${activeTripId}/points`, point, token);
                    setTripTrackingLastUpdated(pointTime);
                    setTripTrackingStatus("tracking");
                } catch (e: any) {
                    setPendingGpsPoints((prev) => [
                        ...prev,
                        { temp_id: `offline-gps-${activeTripId}-${pointTime}`, payload: point },
                    ]);
                    setTripTrackingLastUpdated(pointTime);
                    setTripTrackingStatus("error");
                    setError(e.message || "GPS point saved locally and will retry when connected");
                }
            },
            (err) => {
                setTripTrackingStatus("error");
                setError(err.message);
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );

        return () => {
            if (watchIdRef.current !== null && role === "driver" && !activeTripId) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [role, token, activeTripId, geoSupported, setError]);

    function resetData() {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        setVehicles([]);
        setDrivers([]);
        setTrips([]);
        setLiveTrips([]);
        setFuelLogs([]);
        setMaintenance([]);
        setDocuments([]);
        setServiceCenters([]);
        setServiceBookings([]);
        setDriverScores([]);
        setMaintenancePredictions([]);
        setFuelForecasts([]);
        setMlVehicleId("");
        setVehicleMileage("");
        setEditingFuelId(null);
        setFuelVehicle("");
        setFuelDate("");
        setFuelLiters("");
        setFuelCost("");
        setFuelOdometer("");
        setFuelVendor("");
        setEditingMaintenanceId(null);
        setMaintVehicle("");
        setMaintDate("");
        setMaintType("");
        setMaintCost("");
        setMaintOdometer("");
        setMaintNextDue("");
        setMaintNotes("");
        setCenterName("");
        setCenterPhone("");
        setCenterAddress("");
        setCenterPortalEmail("");
        setCenterPortalPassword("");
        setEditingCenterId(null);
        setBookingVehicle("");
        setBookingCenter("");
        setBookingDate("");
        setBookingNotes("");
        setEditingBookingId(null);
        setActiveTripId(null);
        setTripTrackingStatus("inactive");
        setTripTrackingLastUpdated(null);
        setPendingTripEvents([]);
        setPendingGpsPoints([]);
        setSyncingTripQueue(false);
        syncingTripQueueRef.current = false;
        removeLocalStorage(DRIVER_PENDING_TRIPS_KEY);
        removeLocalStorage(DRIVER_PENDING_GPS_POINTS_KEY);
        setDocOwnerType("vehicle");
        setDocVehicle("");
        setDocDriver("");
        setDocType("");
        setDocNumber("");
        setDocExpiry("");
        setEditingDocumentId(null);
    }

    // Handlers
    async function refreshVehicleMaintenancePrediction(vehicleId: string, updateMaintResult = false) {
        if (!token) return;
        const result = await apiPost<{
            vehicle_id: string;
            prediction: number;
            probability: number;
            threshold_used: number;
            risk_level: "low" | "medium" | "high";
        }>(`/ml/maintenance/by-vehicle/${vehicleId}`, {}, token);

        const latest = await apiGet<MaintenancePrediction[]>(`/ml/maintenance/predictions?vehicle_id=${vehicleId}`, token);
        setMaintenancePredictions((prev) => {
            const rest = prev.filter((item) => item.vehicle_id !== vehicleId);
            return [...latest, ...rest];
        });

        if (updateMaintResult) {
            setMaintResult(
                JSON.stringify({
                    vehicle_id: result.vehicle_id,
                    prediction: result.prediction,
                    probability: Number(result.probability.toFixed(4)),
                    risk_level: result.risk_level,
                })
            );
        }
    }

    async function handleSaveVehicle(e: FormEvent) {
        e.preventDefault();
        if (!token || !orgId) return;
        setError(null);
        setLoading(true);
        try {
            if (!plateNo.trim()) throw new Error("Plate number is required");
            const payload = {
                plate_no: plateNo,
                make: make || undefined,
                model: model || undefined,
                vehicle_type: vehicleType || undefined,
                year: year ? Number(year) : undefined,
                status: vehicleStatus || undefined,
                mileage: vehicleMileage ? Number(vehicleMileage) : undefined,
                odometer_km: vehicleOdometer
                    ? Number(vehicleOdometer)
                    : vehicleMileage
                      ? Number(vehicleMileage)
                      : undefined,
                transmission_type: transmissionType || undefined,
                engine_size_cc: engineSizeCc ? Number(engineSizeCc) : undefined,
                accident_history_count: accidentHistoryCount ? Number(accidentHistoryCount) : undefined,
                fuel_efficiency: fuelEfficiency ? Number(fuelEfficiency) : undefined,
                maintenance_history: maintenanceHistory || undefined,
                reported_issues_count: reportedIssuesCount ? Number(reportedIssuesCount) : undefined,
                tire_condition: tireCondition || undefined,
                brake_condition: brakeCondition || undefined,
                battery_status: batteryStatus || undefined,
            };
            let savedVehicleId: string;
            if (editingVehicleId) {
                const updated = await apiPatch<Vehicle>(`/vehicles/${editingVehicleId}`, payload, token);
                setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
                savedVehicleId = updated.id;
            } else {
                const created = await apiPost<Vehicle>("/vehicles", payload, token);
                setVehicles((prev) => [created, ...prev]);
                savedVehicleId = created.id;
            }
            await refreshVehicleMaintenancePrediction(savedVehicleId);
            setPlateNo("");
            setMake("");
            setModel("");
            setVehicleType("");
            setYear("");
            setVehicleStatus("active");
            setVehicleMileage("");
            setVehicleOdometer("");
            setTransmissionType("");
            setEngineSizeCc("");
            setAccidentHistoryCount("0");
            setFuelEfficiency("");
            setMaintenanceHistory("");
            setReportedIssuesCount("0");
            setTireCondition("");
            setBrakeCondition("");
            setBatteryStatus("");
            setEditingVehicleId(null);
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditVehicle(vehicle: Vehicle) {
        setEditingVehicleId(vehicle.id);
        setPlateNo(vehicle.plate_no);
        setMake(vehicle.make || "");
        setModel(vehicle.model || "");
        setVehicleType(vehicle.vehicle_type || "");
        setYear(vehicle.year ? String(vehicle.year) : "");
        setVehicleStatus(vehicle.status || "active");
        setVehicleMileage(
            vehicle.mileage !== undefined && vehicle.mileage !== null
                ? String(vehicle.mileage)
                : ""
        );
        setVehicleOdometer(
            vehicle.odometer_km !== undefined && vehicle.odometer_km !== null
                ? String(vehicle.odometer_km)
                : ""
        );
        setTransmissionType(vehicle.transmission_type || "");
        setEngineSizeCc(
            vehicle.engine_size_cc !== undefined && vehicle.engine_size_cc !== null
                ? String(vehicle.engine_size_cc)
                : ""
        );
        setAccidentHistoryCount(String(vehicle.accident_history_count ?? 0));
        setFuelEfficiency(
            vehicle.fuel_efficiency !== undefined && vehicle.fuel_efficiency !== null
                ? String(vehicle.fuel_efficiency)
                : ""
        );
        setMaintenanceHistory(vehicle.maintenance_history || "");
        setReportedIssuesCount(String(vehicle.reported_issues_count ?? 0));
        setTireCondition(vehicle.tire_condition || "");
        setBrakeCondition(vehicle.brake_condition || "");
        setBatteryStatus(vehicle.battery_status || "");
    }

    function handleCancelVehicleEdit() {
        setEditingVehicleId(null);
        setPlateNo("");
        setMake("");
        setModel("");
        setVehicleType("");
        setYear("");
        setVehicleStatus("active");
        setVehicleMileage("");
        setVehicleOdometer("");
        setTransmissionType("");
        setEngineSizeCc("");
        setAccidentHistoryCount("0");
        setFuelEfficiency("");
        setMaintenanceHistory("");
        setReportedIssuesCount("0");
        setTireCondition("");
        setBrakeCondition("");
        setBatteryStatus("");
    }

    async function handleDeleteVehicle(vehicleId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/vehicles/${vehicleId}`, token);
            setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
            if (editingVehicleId === vehicleId) {
                handleCancelVehicleEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveDriver(e: FormEvent) {
        e.preventDefault();
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            if (editingDriverId) {
                const payload = {
                    email: driverEmail || undefined,
                    password: driverPassword || undefined,
                    status: driverStatus || undefined,
                    full_name: driverName || undefined,
                    phone: driverPhone || undefined,
                };
                const updated = await apiPatch<Driver>(`/drivers/${editingDriverId}`, payload, token);
                setDrivers((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            } else {
                if (!driverEmail.trim() || !driverPassword.trim()) {
                    throw new Error("Driver email and password are required");
                }
                const payload = {
                    email: driverEmail,
                    password: driverPassword,
                    status: driverStatus || undefined,
                    full_name: driverName || undefined,
                    phone: driverPhone || undefined,
                };
                const created = await apiPost<Driver>("/drivers", payload, token);
                setDrivers((prev) => [created, ...prev]);
            }
            setDriverName("");
            setDriverEmail("");
            setDriverPhone("");
            setDriverStatus("active");
            setDriverPassword("");
            setEditingDriverId(null);
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditDriver(driver: Driver) {
        setEditingDriverId(driver.id);
        setDriverName(driver.full_name || "");
        setDriverEmail(driver.email || "");
        setDriverPhone(driver.phone || "");
        setDriverStatus(driver.status || "active");
        setDriverPassword("");
    }

    function handleCancelDriverEdit() {
        setEditingDriverId(null);
        setDriverName("");
        setDriverEmail("");
        setDriverPhone("");
        setDriverStatus("active");
        setDriverPassword("");
    }

    async function handleDeleteDriver(driverId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/drivers/${driverId}`, token);
            setDrivers((prev) => prev.filter((d) => d.id !== driverId));
            if (editingDriverId === driverId) {
                handleCancelDriverEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function getCurrentGpsPoint(tripId: string): Promise<OfflineGpsPoint | undefined> {
        if (!geoSupported || typeof navigator === "undefined" || !navigator.geolocation) return undefined;
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(buildGpsPointFromPosition(tripId, pos)),
                () => resolve(undefined),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
            );
        });
    }

    async function startTrip(tripId?: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            if (role !== "driver") throw new Error("Only drivers can start trips");
            if (!geoSupported)
                throw new Error("Geolocation is not supported on this device");
            if (!tripId) throw new Error("No assigned trip is available to start");
            if (pendingTripEvents.length) throw new Error("A pending trip sync must finish before starting another trip");
            const now = new Date();
            if (!navigator.onLine) {
                const start_time = now.toISOString();
                const point = await getCurrentGpsPoint(tripId);
                const event: PendingTripEvent = {
                    trip_id: tripId,
                    type: "start",
                    event_time: start_time,
                    created_at: start_time,
                    point,
                };
                setPendingTripEvents((prev) => [...prev, event]);
                setTrips((prev) => prev.map((trip) => trip.id === tripId ? {
                    ...trip,
                    status: "in_progress",
                    start_time,
                    start_lat: point?.lat ?? trip.start_lat,
                    start_lon: point?.lon ?? trip.start_lon,
                } : trip));
                if (point) {
                    setPendingGpsPoints((prev) => [
                        ...prev,
                        { temp_id: `offline-gps-${tripId}-${point.recorded_at}`, payload: point },
                    ]);
                    setTripTrackingLastUpdated(point.recorded_at);
                } else {
                    setTripTrackingLastUpdated(null);
                }
                setActiveTripId(tripId);
                setTripTrackingStatus("tracking");
                setError("Trip started offline. It will sync when the connection returns.");
                return;
            }
            const payload = { status: "in_progress", start_time: now.toISOString() };
            const trip = await apiPatch<Trip>(`/trips/${tripId}`, payload, token);
            setActiveTripId(trip.id);
            setTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
            setTripTrackingStatus("tracking");
            setTripTrackingLastUpdated(null);
        } catch (err: any) {
            setError(err.message || "Start trip failed");
        } finally {
            setLoading(false);
        }
    }

    async function stopTrip() {
        if (!token || !activeTripId) return;
        setError(null);
        setLoading(true);
        try {
            const now = new Date();
            if (!navigator.onLine || pendingTripStatusById[activeTripId]) {
                const end_time = now.toISOString();
                const point = await getCurrentGpsPoint(activeTripId);
                const event: PendingTripEvent = {
                    trip_id: activeTripId,
                    type: "end",
                    event_time: end_time,
                    created_at: end_time,
                    point,
                };
                setPendingTripEvents((prev) => {
                    const withoutExistingEnd = prev.filter((item) => !(item.trip_id === activeTripId && item.type === "end"));
                    return [...withoutExistingEnd, event];
                });
                if (point) {
                    setPendingGpsPoints((prev) => [
                        ...prev,
                        { temp_id: `offline-gps-${activeTripId}-${point.recorded_at}`, payload: point },
                    ]);
                }
                setTrips((prev) => prev.map((trip) => trip.id === activeTripId ? {
                    ...trip,
                    status: "completed",
                    end_time,
                    end_lat: point?.lat ?? trip.end_lat,
                    end_lon: point?.lon ?? trip.end_lon,
                } : trip));
                setActiveTripId(null);
                setTripTrackingStatus("inactive");
                setTripTrackingLastUpdated(null);
                if (watchIdRef.current !== null) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                    watchIdRef.current = null;
                }
                setError("Trip ended offline. It will sync when the connection returns.");
                return;
            }
            const payload = { status: "completed", end_time: now.toISOString() };
            const updated = await apiPatch<Trip>(`/trips/${activeTripId}`, payload, token);
            setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setActiveTripId(null);
            setTripTrackingStatus("inactive");
            setTripTrackingLastUpdated(null);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        } catch (err: any) {
            setError(err.message || "Stop trip failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateTripAssignment(payload: {
        vehicle_id: string;
        driver_id: string;
        trip_title?: string;
        scheduled_start?: string;
        origin_label?: string;
        destination_label?: string;
        origin_lat?: number;
        origin_lon?: number;
        destination_lat?: number;
        destination_lon?: number;
        contact_name?: string;
        contact_phone?: string;
        priority?: string;
        notes?: string;
        status?: string;
    }) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            const created = await apiPost<Trip>("/trips", payload, token);
            setTrips((prev) => [created, ...prev]);
        } catch (err: any) {
            setError(err.message || "Trip assignment failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateTripAssignment(
        tripId: string,
        payload: {
            vehicle_id?: string;
            driver_id?: string;
            trip_title?: string;
            scheduled_start?: string;
            origin_label?: string;
            destination_label?: string;
            origin_lat?: number;
            origin_lon?: number;
            destination_lat?: number;
            destination_lon?: number;
            contact_name?: string;
            contact_phone?: string;
            priority?: string;
            notes?: string;
            status?: string;
        }
    ) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            const updated = await apiPatch<Trip>(`/trips/${tripId}`, payload, token);
            setTrips((prev) => prev.map((trip) => (trip.id === updated.id ? updated : trip)));
        } catch (err: any) {
            setError(err.message || "Trip update failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteTripRecord(tripId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/trips/${tripId}`, token);
            setTrips((prev) => prev.filter((trip) => trip.id !== tripId));
        } catch (err: any) {
            setError(err.message || "Trip delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddFuel(e: FormEvent) {
        e.preventDefault();
        if (!token || !fuelVehicle) return;
        setError(null);
        setLoading(true);
        try {
            if (!fuelDate || !fuelLiters) throw new Error("Fuel date and liters are required");
            const payload = {
                vehicle_id: fuelVehicle,
                fuel_date: fuelDate,
                liters: Number(fuelLiters),
                cost_lkr: fuelCost ? Number(fuelCost) : undefined,
                odometer_km: fuelOdometer ? Number(fuelOdometer) : undefined,
                vendor: fuelVendor || undefined,
            };
            if (editingFuelId) {
                const updated = await apiPatch<FuelLog>(`/fuel-logs/${editingFuelId}`, payload, token);
                setFuelLogs((prev) => prev.map((log) => (log.id === updated.id ? updated : log)));
            } else {
                const created = await apiPost<FuelLog>("/fuel-logs", payload, token);
                setFuelLogs((prev) => [created, ...prev]);
            }
            setFuelVehicle("");
            setFuelDate("");
            setFuelLiters("");
            setFuelCost("");
            setFuelOdometer("");
            setFuelVendor("");
            setEditingFuelId(null);
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditFuel(fuelLog: FuelLog) {
        setEditingFuelId(fuelLog.id);
        setFuelVehicle(fuelLog.vehicle_id || "");
        setFuelDate(fuelLog.fuel_date || "");
        setFuelLiters(typeof fuelLog.liters === "number" ? String(fuelLog.liters) : "");
        setFuelCost(typeof fuelLog.cost_lkr === "number" ? String(fuelLog.cost_lkr) : "");
        setFuelOdometer(typeof fuelLog.odometer_km === "number" ? String(fuelLog.odometer_km) : "");
        setFuelVendor(fuelLog.vendor || "");
    }

    function handleCancelFuelEdit() {
        setEditingFuelId(null);
        setFuelVehicle("");
        setFuelDate("");
        setFuelLiters("");
        setFuelCost("");
        setFuelOdometer("");
        setFuelVendor("");
    }

    async function handleDeleteFuel(fuelId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/fuel-logs/${fuelId}`, token);
            setFuelLogs((prev) => prev.filter((log) => log.id !== fuelId));
            if (editingFuelId === fuelId) {
                handleCancelFuelEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddMaintenance(e: FormEvent) {
        e.preventDefault();
        if (!token || !maintVehicle) return;
        setError(null);
        setLoading(true);
        try {
            if (!maintDate) throw new Error("Service date is required");
            const payload = {
                vehicle_id: maintVehicle,
                service_date: maintDate,
                service_type: maintType || undefined,
                cost_lkr: maintCost ? Number(maintCost) : undefined,
                odometer_km: maintOdometer ? Number(maintOdometer) : undefined,
                next_service_due_km: maintNextDue ? Number(maintNextDue) : undefined,
                notes: maintNotes || undefined,
            };
            if (editingMaintenanceId) {
                const updated = await apiPatch<Maintenance>(`/maintenance/${editingMaintenanceId}`, payload, token);
                setMaintenance((prev) => prev.map((record) => (record.id === updated.id ? updated : record)));
            } else {
                const created = await apiPost<Maintenance>("/maintenance", payload, token);
                setMaintenance((prev) => [created, ...prev]);
            }
            setMaintVehicle("");
            setMaintDate("");
            setMaintType("");
            setMaintCost("");
            setMaintOdometer("");
            setMaintNextDue("");
            setMaintNotes("");
            setEditingMaintenanceId(null);
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditMaintenance(record: Maintenance) {
        setEditingMaintenanceId(record.id);
        setMaintVehicle(record.vehicle_id || "");
        setMaintDate(record.service_date || "");
        setMaintType(record.service_type || "");
        setMaintCost(typeof record.cost_lkr === "number" ? String(record.cost_lkr) : "");
        setMaintOdometer(typeof record.odometer_km === "number" ? String(record.odometer_km) : "");
        setMaintNextDue(typeof record.next_service_due_km === "number" ? String(record.next_service_due_km) : "");
        setMaintNotes(record.notes || "");
    }

    function handleCancelMaintenanceEdit() {
        setEditingMaintenanceId(null);
        setMaintVehicle("");
        setMaintDate("");
        setMaintType("");
        setMaintCost("");
        setMaintOdometer("");
        setMaintNextDue("");
        setMaintNotes("");
    }

    async function handleDeleteMaintenance(maintenanceId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/maintenance/${maintenanceId}`, token);
            setMaintenance((prev) => prev.filter((record) => record.id !== maintenanceId));
            if (editingMaintenanceId === maintenanceId) {
                handleCancelMaintenanceEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddDocument(e: FormEvent) {
        e.preventDefault();
        if (!token || !docType) return;
        setError(null);
        setLoading(true);
        try {
            if (!docType.trim()) throw new Error("Document type is required");
            if (docOwnerType === "vehicle" && !docVehicle) {
                throw new Error("Select a vehicle document owner");
            }
            if (docOwnerType === "driver" && !docDriver) {
                throw new Error("Select a driver document owner");
            }
            const payload = {
                vehicle_id: docOwnerType === "vehicle" ? docVehicle || undefined : undefined,
                driver_id: docOwnerType === "driver" ? docDriver || undefined : undefined,
                doc_type: docType,
                doc_number: docNumber || undefined,
                expiry_date: docExpiry || undefined,
            };
            if (editingDocumentId) {
                const updated = await apiPatch<Document>(`/documents/${editingDocumentId}`, payload, token);
                setDocuments((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
            } else {
                const created = await apiPost<Document>("/documents", payload, token);
                setDocuments((prev) => [created, ...prev]);
            }
            setDocOwnerType("vehicle");
            setDocVehicle("");
            setDocDriver("");
            setDocType("");
            setDocNumber("");
            setDocExpiry("");
            setEditingDocumentId(null);
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditDocument(document: Document) {
        setEditingDocumentId(document.id);
        if (document.driver_id) {
            setDocOwnerType("driver");
            setDocDriver(document.driver_id);
            setDocVehicle("");
        } else {
            setDocOwnerType("vehicle");
            setDocVehicle(document.vehicle_id || "");
            setDocDriver("");
        }
        setDocType(document.doc_type || "");
        setDocNumber(document.doc_number || "");
        setDocExpiry(document.expiry_date || "");
    }

    function handleCancelDocumentEdit() {
        setEditingDocumentId(null);
        setDocOwnerType("vehicle");
        setDocVehicle("");
        setDocDriver("");
        setDocType("");
        setDocNumber("");
        setDocExpiry("");
    }

    async function handleDeleteDocument(documentId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/documents/${documentId}`, token);
            setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
            if (editingDocumentId === documentId) {
                handleCancelDocumentEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditCenter(center: ServiceCenter) {
        setEditingCenterId(center.id);
        setCenterName(center.name || "");
        setCenterPhone(center.phone || "");
        setCenterAddress(center.address || "");
        setCenterPortalEmail("");
        setCenterPortalPassword("");
    }

    function handleCancelCenterEdit() {
        setEditingCenterId(null);
        setCenterName("");
        setCenterPhone("");
        setCenterAddress("");
        setCenterPortalEmail("");
        setCenterPortalPassword("");
    }

    async function handleAddCenter(e: FormEvent) {
        e.preventDefault();
        if (!token || !centerName) return;
        setError(null);
        setLoading(true);
        try {
            if (!centerName.trim()) throw new Error("Service center name is required");
            if (!editingCenterId && ((centerPortalEmail && !centerPortalPassword) || (!centerPortalEmail && centerPortalPassword))) {
                throw new Error("Portal email and password must both be provided to create a service center login");
            }
            const payload = {
                name: centerName,
                phone: centerPhone || undefined,
                address: centerAddress || undefined,
                portal_email: centerPortalEmail || undefined,
                portal_password: centerPortalPassword || undefined,
                portal_contact_name: centerName || undefined,
            };
            if (editingCenterId) {
                const updated = await apiPatch<ServiceCenter>(`/service-centers/${editingCenterId}`, payload, token);
                setServiceCenters((prev) => prev.map((center) => (center.id === updated.id ? updated : center)));
            } else {
                const created = await apiPost<ServiceCenter>("/service-centers", payload, token);
                setServiceCenters((prev) => [created, ...prev]);
            }
            handleCancelCenterEdit();
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteCenter(centerId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/service-centers/${centerId}`, token);
            setServiceCenters((prev) => prev.filter((center) => center.id !== centerId));
            if (editingCenterId === centerId) {
                handleCancelCenterEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddBooking(e: FormEvent) {
        e.preventDefault();
        if (!token || !bookingVehicle || !bookingCenter) return;
        setError(null);
        setLoading(true);
        try {
            if (!bookingDate) throw new Error("Booking date is required");
            if (editingBookingId) {
                const updated = await apiPatch<ServiceBooking>(
                    `/service-bookings/${editingBookingId}`,
                    {
                        requested_date: bookingDate,
                        notes: bookingNotes || undefined,
                    },
                    token
                );
                setServiceBookings((prev) => prev.map((booking) => (booking.id === updated.id ? updated : booking)));
            } else {
                const created = await apiPost<ServiceBooking>(
                    "/service-bookings",
                    {
                        vehicle_id: bookingVehicle,
                        center_id: bookingCenter,
                        requested_date: bookingDate,
                        notes: bookingNotes || undefined,
                    },
                    token
                );
                setServiceBookings((prev) => [created, ...prev]);
            }
            handleCancelBookingEdit();
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    function handleEditBooking(booking: ServiceBooking) {
        setEditingBookingId(booking.id);
        setBookingVehicle(booking.vehicle_id || "");
        setBookingCenter(booking.center_id || "");
        setBookingDate(booking.requested_date || "");
        setBookingNotes(booking.notes || "");
    }

    function handleCancelBookingEdit() {
        setEditingBookingId(null);
        setBookingVehicle("");
        setBookingCenter("");
        setBookingDate("");
        setBookingNotes("");
    }

    async function handleDeleteBooking(bookingId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            await apiDelete(`/service-bookings/${bookingId}`, token);
            setServiceBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
            if (editingBookingId === bookingId) {
                handleCancelBookingEdit();
            }
        } catch (err: any) {
            setError(err.message || "Delete failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleApproveBookingCompletion(bookingId: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            const approved = await apiPost<ServiceBooking>(`/service-bookings/${bookingId}/approve-completion`, {}, token);
            setServiceBookings((prev) => prev.map((booking) => (booking.id === approved.id ? approved : booking)));
            const [vehiclesData, maintenanceData] = await Promise.all([
                apiGet<Vehicle[]>("/vehicles", token),
                apiGet<Maintenance[]>("/maintenance", token),
            ]);
            setVehicles(vehiclesData);
            setMaintenance(maintenanceData);
        } catch (err: any) {
            setError(err.message || "Approval failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleRejectBookingCompletion(bookingId: string, note: string) {
        if (!token) return;
        setError(null);
        setLoading(true);
        try {
            const rejected = await apiPost<ServiceBooking>(
                `/service-bookings/${bookingId}/reject-completion`,
                { note },
                token
            );
            setServiceBookings((prev) => prev.map((booking) => (booking.id === rejected.id ? rejected : booking)));
        } catch (err: any) {
            setError(err.message || "Rejection failed");
        } finally {
            setLoading(false);
        }
    }

    const parseFeatureLines = (raw: string) => {
        return raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.split(",").map((v) => Number(v.trim())));
    };

    async function handlePredictMaintenance(e: FormEvent) {
        e.preventDefault();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const features = parseFeatureLines(maintFeatures);
            const res = await apiPost<{ predictions: number[] }>("/ml/maintenance", { features }, token);
            setMaintResult(JSON.stringify(res.predictions));
        } catch (err: any) {
            setError(err.message || "Prediction failed");
        } finally {
            setLoading(false);
        }
    }

    async function handlePredictFuel(e: FormEvent) {
        e.preventDefault();
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const features = parseFeatureLines(fuelFeatures);
            const res = await apiPost<{ predictions: number[] }>("/ml/fuel", { features }, token);
            setFuelResult(JSON.stringify(res.predictions));
        } catch (err: any) {
            setError(err.message || "Prediction failed");
        } finally {
            setLoading(false);
        }
    }

    async function runVehicleMaintenanceCheck(vehicleId: string) {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            await refreshVehicleMaintenancePrediction(vehicleId, true);
        } catch (err: any) {
            setError(err.message || "Vehicle prediction failed");
        } finally {
            setLoading(false);
        }
    }

    function buildAlerts(): Alert[] {
        const alerts: Alert[] = [];
        const nowDate = new Date();
        nowDate.setHours(0, 0, 0, 0);
        const now = nowDate.getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        documents.forEach((d) => {
            if (!d.expiry_date) return;
            const date = new Date(d.expiry_date).getTime();
            if (date <= now + sevenDays) {
                alerts.push({
                    title: `${date < now ? "Document expired" : "Document expiring"}: ${d.doc_type}`,
                    meta: `${date < now ? "Expired" : "Expires"} ${d.expiry_date}`,
                });
            }
        });

        serviceBookings.forEach((booking) => {
            if (
                (booking.status || "pending") === "completed" &&
                (booking.completion_review_status || "pending") !== "approved"
            ) {
                alerts.push({
                    title: "Service completion pending approval",
                    meta: `Requested ${booking.requested_date}`,
                });
            }
        });

        return alerts;
    }

    return (
        <DataContext.Provider
            value={{
                vehicles,
                drivers,
                trips,
                liveTrips,
                fuelLogs,
                maintenance,
                documents,
                serviceCenters,
                serviceBookings,
                driverScores,
                maintenancePredictions,
                activeTrips,
                fuelCostTotal,
                currency,
                geoSupported,
                upcomingDocs,
                driverScore,
                driverScoreLabel,
                driverScoreBreakdown,
                topPerformers,
                plateNo,
                setPlateNo,
                make,
                setMake,
                model,
                setModel,
                vehicleType,
                setVehicleType,
                year,
                setYear,
                vehicleStatus,
                vehicleMileage,
                setVehicleStatus,
                setVehicleMileage,
                vehicleOdometer,
                setVehicleOdometer,
                transmissionType,
                setTransmissionType,
                engineSizeCc,
                setEngineSizeCc,
                accidentHistoryCount,
                setAccidentHistoryCount,
                fuelEfficiency,
                setFuelEfficiency,
                maintenanceHistory,
                setMaintenanceHistory,
                reportedIssuesCount,
                setReportedIssuesCount,
                tireCondition,
                setTireCondition,
                brakeCondition,
                setBrakeCondition,
                batteryStatus,
                setBatteryStatus,
                editingVehicleId,
                driverName,
                setDriverName,
                driverEmail,
                setDriverEmail,
                driverPhone,
                setDriverPhone,
                driverStatus,
                setDriverStatus,
                driverPassword,
                setDriverPassword,
                editingDriverId,
                selectedVehicle,
                setSelectedVehicle,
                activeTripId,
                tripTrackingStatus,
                tripTrackingLastUpdated,
                pendingTripSyncCount: pendingTripEvents.length,
                pendingGpsPointCount: pendingGpsPoints.length,
                syncingTripQueue,
                pendingTripStatusById,
                fuelVehicle,
                setFuelVehicle,
                fuelDate,
                setFuelDate,
                fuelLiters,
                setFuelLiters,
                fuelCost,
                setFuelCost,
                fuelOdometer,
                setFuelOdometer,
                fuelVendor,
                setFuelVendor,
                editingFuelId,
                maintVehicle,
                setMaintVehicle,
                maintDate,
                setMaintDate,
                maintType,
                setMaintType,
                maintCost,
                setMaintCost,
                maintOdometer,
                setMaintOdometer,
                maintNextDue,
                setMaintNextDue,
                maintNotes,
                setMaintNotes,
                editingMaintenanceId,
                docOwnerType,
                setDocOwnerType,
                docVehicle,
                setDocVehicle,
                docDriver,
                setDocDriver,
                docType,
                setDocType,
                docNumber,
                setDocNumber,
                docExpiry,
                setDocExpiry,
                editingDocumentId,
                centerName,
                setCenterName,
                centerPhone,
                setCenterPhone,
                centerAddress,
                setCenterAddress,
                centerPortalEmail,
                setCenterPortalEmail,
                centerPortalPassword,
                setCenterPortalPassword,
                editingCenterId,
                bookingVehicle,
                setBookingVehicle,
                bookingCenter,
                setBookingCenter,
                bookingDate,
                setBookingDate,
                bookingNotes,
                setBookingNotes,
                editingBookingId,
                maintFeatures,
                setMaintFeatures,
                fuelFeatures,
                setFuelFeatures,
                mlVehicleId,
                setMlVehicleId,
                maintResult,
                fuelResult,
                maintenancePredictionMap,
                fuelForecasts,
                refreshFuelForecasts,
                handleSaveVehicle,
                handleEditVehicle,
                handleCancelVehicleEdit,
                handleDeleteVehicle,
                handleSaveDriver,
                handleEditDriver,
                handleCancelDriverEdit,
                handleDeleteDriver,
                startTrip,
                stopTrip,
                handleCreateTripAssignment,
                handleUpdateTripAssignment,
                handleDeleteTripRecord,
                handleAddFuel,
                handleEditFuel,
                handleCancelFuelEdit,
                handleDeleteFuel,
                handleAddMaintenance,
                handleEditMaintenance,
                handleCancelMaintenanceEdit,
                handleDeleteMaintenance,
                handleAddDocument,
                handleEditDocument,
                handleCancelDocumentEdit,
                handleDeleteDocument,
                handleAddCenter,
                handleEditCenter,
                handleCancelCenterEdit,
                handleDeleteCenter,
                handleAddBooking,
                handleEditBooking,
                handleCancelBookingEdit,
                handleDeleteBooking,
                handleApproveBookingCompletion,
                handleRejectBookingCompletion,
                handlePredictMaintenance,
                handlePredictFuel,
                runVehicleMaintenanceCheck,
                buildAlerts,
                resetData,
            }}
        >
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error("useData must be used within DataProvider");
    return ctx;
}
