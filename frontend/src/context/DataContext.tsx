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
    Maintenance,
    Document,
    ServiceCenter,
    ServiceBooking,
    Alert,
} from "../types";

type DataContextType = {
    // Entity state
    vehicles: Vehicle[];
    drivers: Driver[];
    trips: Trip[];
    fuelLogs: FuelLog[];
    maintenance: Maintenance[];
    documents: Document[];
    serviceCenters: ServiceCenter[];
    serviceBookings: ServiceBooking[];

    // Computed values
    activeTrips: number;
    fuelCostTotal: number;
    currency: Intl.NumberFormat;
    geoSupported: boolean;
    upcomingDocs: Document[];

    // Vehicle form state
    plateNo: string;
    setPlateNo: (v: string) => void;
    make: string;
    setMake: (v: string) => void;
    model: string;
    setModel: (v: string) => void;
    year: string;
    setYear: (v: string) => void;
    editingVehicleId: string | null;

    // Driver form state
    driverName: string;
    setDriverName: (v: string) => void;
    driverEmail: string;
    setDriverEmail: (v: string) => void;
    driverPhone: string;
    setDriverPhone: (v: string) => void;
    driverPassword: string;
    setDriverPassword: (v: string) => void;
    editingDriverId: string | null;

    // Trip state
    selectedVehicle: string;
    setSelectedVehicle: (v: string) => void;
    activeTripId: string | null;

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
    maintPredictedDate: string;
    setMaintPredictedDate: (v: string) => void;
    maintNotes: string;
    setMaintNotes: (v: string) => void;

    // Document form state
    docVehicle: string;
    setDocVehicle: (v: string) => void;
    docType: string;
    setDocType: (v: string) => void;
    docNumber: string;
    setDocNumber: (v: string) => void;
    docExpiry: string;
    setDocExpiry: (v: string) => void;

    // Service center form state
    centerName: string;
    setCenterName: (v: string) => void;
    centerPhone: string;
    setCenterPhone: (v: string) => void;
    centerAddress: string;
    setCenterAddress: (v: string) => void;

    // Booking form state
    bookingVehicle: string;
    setBookingVehicle: (v: string) => void;
    bookingCenter: string;
    setBookingCenter: (v: string) => void;
    bookingDate: string;
    setBookingDate: (v: string) => void;
    bookingNotes: string;
    setBookingNotes: (v: string) => void;

    // ML state
    maintFeatures: string;
    setMaintFeatures: (v: string) => void;
    fuelFeatures: string;
    setFuelFeatures: (v: string) => void;
    maintResult: string | null;
    fuelResult: string | null;

    // Handlers
    handleSaveVehicle: (e: FormEvent) => Promise<void>;
    handleEditVehicle: (vehicle: Vehicle) => void;
    handleCancelVehicleEdit: () => void;
    handleDeleteVehicle: (vehicleId: string) => Promise<void>;
    handleSaveDriver: (e: FormEvent) => Promise<void>;
    handleEditDriver: (driver: Driver) => void;
    handleCancelDriverEdit: () => void;
    handleDeleteDriver: (driverId: string) => Promise<void>;
    startTrip: () => Promise<void>;
    stopTrip: () => Promise<void>;
    handleAddFuel: (e: FormEvent) => Promise<void>;
    handleAddMaintenance: (e: FormEvent) => Promise<void>;
    handleAddDocument: (e: FormEvent) => Promise<void>;
    handleAddCenter: (e: FormEvent) => Promise<void>;
    handleAddBooking: (e: FormEvent) => Promise<void>;
    handlePredictMaintenance: (e: FormEvent) => Promise<void>;
    handlePredictFuel: (e: FormEvent) => Promise<void>;
    buildAlerts: () => Alert[];

    // Reset on logout
    resetData: () => void;
};

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
    const { token, orgId, role, setError, setLoading, loading } = useAuth();

    // Entity state
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
    const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
    const [serviceBookings, setServiceBookings] = useState<ServiceBooking[]>([]);

    // Vehicle form
    const [plateNo, setPlateNo] = useState("");
    const [make, setMake] = useState("");
    const [model, setModel] = useState("");
    const [year, setYear] = useState("");
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

    // Driver form
    const [driverName, setDriverName] = useState("");
    const [driverEmail, setDriverEmail] = useState("");
    const [driverPhone, setDriverPhone] = useState("");
    const [driverPassword, setDriverPassword] = useState("");
    const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

    // Trip state
    const [selectedVehicle, setSelectedVehicle] = useState("");
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const watchIdRef = useRef<number | null>(null);

    // Fuel form
    const [fuelVehicle, setFuelVehicle] = useState("");
    const [fuelDate, setFuelDate] = useState("");
    const [fuelLiters, setFuelLiters] = useState("");
    const [fuelCost, setFuelCost] = useState("");
    const [fuelOdometer, setFuelOdometer] = useState("");
    const [fuelVendor, setFuelVendor] = useState("");

    // Maintenance form
    const [maintVehicle, setMaintVehicle] = useState("");
    const [maintDate, setMaintDate] = useState("");
    const [maintType, setMaintType] = useState("");
    const [maintCost, setMaintCost] = useState("");
    const [maintOdometer, setMaintOdometer] = useState("");
    const [maintNextDue, setMaintNextDue] = useState("");
    const [maintPredictedDate, setMaintPredictedDate] = useState("");
    const [maintNotes, setMaintNotes] = useState("");

    // Document form
    const [docVehicle, setDocVehicle] = useState("");
    const [docType, setDocType] = useState("");
    const [docNumber, setDocNumber] = useState("");
    const [docExpiry, setDocExpiry] = useState("");

    // Service center form
    const [centerName, setCenterName] = useState("");
    const [centerPhone, setCenterPhone] = useState("");
    const [centerAddress, setCenterAddress] = useState("");

    // Booking form
    const [bookingVehicle, setBookingVehicle] = useState("");
    const [bookingCenter, setBookingCenter] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [bookingNotes, setBookingNotes] = useState("");

    // ML state
    const [maintFeatures, setMaintFeatures] = useState("");
    const [fuelFeatures, setFuelFeatures] = useState("");
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
    const activeTrips = trips.filter((t) => !t.end_time).length;
    const fuelCostTotal = fuelLogs.reduce((sum, f) => sum + (f.cost_lkr || 0), 0);

    const upcomingDocs = documents.filter((d) => {
        if (!d.expiry_date) return false;
        const date = new Date(d.expiry_date).getTime();
        const now = new Date().getTime();
        const fourteenDays = 14 * 24 * 60 * 60 * 1000;
        return date <= now + fourteenDays;
    });

    // Data loading
    useEffect(() => {
        if (!token) return;
        const load = async () => {
            try {
                const [v, d, t, f, m, doc, sc, sb] = await Promise.all([
                    apiGet<Vehicle[]>("/vehicles", token),
                    apiGet<Driver[]>("/drivers", token),
                    apiGet<Trip[]>("/trips", token),
                    apiGet<FuelLog[]>("/fuel-logs", token),
                    apiGet<Maintenance[]>("/maintenance", token),
                    apiGet<Document[]>("/documents", token),
                    apiGet<ServiceCenter[]>("/service-centers", token),
                    apiGet<ServiceBooking[]>("/service-bookings", token),
                ]);
                setVehicles(v);
                setDrivers(d);
                setTrips(t);
                setFuelLogs(f);
                setMaintenance(m);
                setDocuments(doc);
                setServiceCenters(sc);
                setServiceBookings(sb);
            } catch (e: any) {
                setError(e.message);
            }
        };
        load();
    }, [token]);

    function resetData() {
        setVehicles([]);
        setDrivers([]);
        setTrips([]);
        setFuelLogs([]);
        setMaintenance([]);
        setDocuments([]);
        setServiceCenters([]);
        setServiceBookings([]);
    }

    // Handlers
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
                year: year ? Number(year) : undefined,
            };
            if (editingVehicleId) {
                const updated = await apiPatch<Vehicle>(`/vehicles/${editingVehicleId}`, payload, token);
                setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            } else {
                const created = await apiPost<Vehicle>("/vehicles", payload, token);
                setVehicles((prev) => [created, ...prev]);
            }
            setPlateNo("");
            setMake("");
            setModel("");
            setYear("");
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
        setYear(vehicle.year ? String(vehicle.year) : "");
    }

    function handleCancelVehicleEdit() {
        setEditingVehicleId(null);
        setPlateNo("");
        setMake("");
        setModel("");
        setYear("");
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
                    full_name: driverName || undefined,
                    phone: driverPhone || undefined,
                };
                const created = await apiPost<Driver>("/drivers", payload, token);
                setDrivers((prev) => [created, ...prev]);
            }
            setDriverName("");
            setDriverEmail("");
            setDriverPhone("");
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
        setDriverEmail("");
        setDriverPhone(driver.phone || "");
        setDriverPassword("");
    }

    function handleCancelDriverEdit() {
        setEditingDriverId(null);
        setDriverName("");
        setDriverEmail("");
        setDriverPhone("");
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

    async function startTrip() {
        if (!token || !selectedVehicle) return;
        setError(null);
        setLoading(true);
        try {
            if (role !== "driver") throw new Error("Only drivers can start trips");
            if (!geoSupported)
                throw new Error("Geolocation is not supported on this device");
            const now = new Date();
            const payload = { vehicle_id: selectedVehicle, start_time: now.toISOString() };
            const trip = await apiPost<Trip>("/trips", payload, token);
            setActiveTripId(trip.id);
            setTrips((prev) => [trip, ...prev]);

            watchIdRef.current = navigator.geolocation.watchPosition(
                async (pos) => {
                    const point = {
                        trip_id: trip.id,
                        recorded_at: new Date(pos.timestamp).toISOString(),
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        speed_kmh: pos.coords.speed ? Number((pos.coords.speed * 3.6).toFixed(2)) : null,
                    };
                    try {
                        await apiPost(`/trips/${trip.id}/points`, point, token);
                    } catch (e: any) {
                        setError(e.message || "Failed to save GPS point");
                    }
                },
                (err) => setError(err.message),
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
            );
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
            const payload = { end_time: now.toISOString() };
            const updated = await apiPatch<Trip>(`/trips/${activeTripId}`, payload, token);
            setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setActiveTripId(null);
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
            const created = await apiPost<FuelLog>("/fuel-logs", payload, token);
            setFuelLogs((prev) => [created, ...prev]);
            setFuelVehicle("");
            setFuelDate("");
            setFuelLiters("");
            setFuelCost("");
            setFuelOdometer("");
            setFuelVendor("");
        } catch (err: any) {
            setError(err.message || "Create failed");
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
                predicted_due_date: maintPredictedDate || undefined,
                notes: maintNotes || undefined,
            };
            const created = await apiPost<Maintenance>("/maintenance", payload, token);
            setMaintenance((prev) => [created, ...prev]);
            setMaintVehicle("");
            setMaintDate("");
            setMaintType("");
            setMaintCost("");
            setMaintOdometer("");
            setMaintNextDue("");
            setMaintPredictedDate("");
            setMaintNotes("");
        } catch (err: any) {
            setError(err.message || "Create failed");
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
            const payload = {
                vehicle_id: docVehicle || undefined,
                doc_type: docType,
                doc_number: docNumber || undefined,
                expiry_date: docExpiry || undefined,
            };
            const created = await apiPost<Document>("/documents", payload, token);
            setDocuments((prev) => [created, ...prev]);
            setDocVehicle("");
            setDocType("");
            setDocNumber("");
            setDocExpiry("");
        } catch (err: any) {
            setError(err.message || "Create failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleAddCenter(e: FormEvent) {
        e.preventDefault();
        if (!token || !centerName) return;
        setError(null);
        setLoading(true);
        try {
            if (!centerName.trim()) throw new Error("Service center name is required");
            const payload = {
                name: centerName,
                phone: centerPhone || undefined,
                address: centerAddress || undefined,
            };
            const created = await apiPost<ServiceCenter>("/service-centers", payload, token);
            setServiceCenters((prev) => [created, ...prev]);
            setCenterName("");
            setCenterPhone("");
            setCenterAddress("");
        } catch (err: any) {
            setError(err.message || "Create failed");
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
            const payload = {
                vehicle_id: bookingVehicle,
                center_id: bookingCenter,
                requested_date: bookingDate,
                notes: bookingNotes || undefined,
            };
            const created = await apiPost<ServiceBooking>("/service-bookings", payload, token);
            setServiceBookings((prev) => [created, ...prev]);
            setBookingVehicle("");
            setBookingCenter("");
            setBookingDate("");
            setBookingNotes("");
        } catch (err: any) {
            setError(err.message || "Create failed");
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

    function buildAlerts(): Alert[] {
        const alerts: Alert[] = [];
        const now = new Date().getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        maintenance.forEach((m) => {
            if (!m.service_date) return;
            const date = new Date(m.service_date).getTime();
            if (date <= now + sevenDays) {
                alerts.push({
                    title: `Maintenance due: ${m.service_type || "Service"}`,
                    meta: `Scheduled ${m.service_date}`,
                });
            }
        });

        documents.forEach((d) => {
            if (!d.expiry_date) return;
            const date = new Date(d.expiry_date).getTime();
            if (date <= now + sevenDays) {
                alerts.push({
                    title: `Document expiring: ${d.doc_type}`,
                    meta: `Expires ${d.expiry_date}`,
                });
            }
        });

        if (fuelLogs.length > 0) {
            alerts.push({
                title: "New fuel logs available",
                meta: `Total entries: ${fuelLogs.length}`,
            });
        }

        return alerts;
    }

    return (
        <DataContext.Provider
            value={{
                vehicles,
                drivers,
                trips,
                fuelLogs,
                maintenance,
                documents,
                serviceCenters,
                serviceBookings,
                activeTrips,
                fuelCostTotal,
                currency,
                geoSupported,
                upcomingDocs,
                plateNo,
                setPlateNo,
                make,
                setMake,
                model,
                setModel,
                year,
                setYear,
                editingVehicleId,
                driverName,
                setDriverName,
                driverEmail,
                setDriverEmail,
                driverPhone,
                setDriverPhone,
                driverPassword,
                setDriverPassword,
                editingDriverId,
                selectedVehicle,
                setSelectedVehicle,
                activeTripId,
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
                maintPredictedDate,
                setMaintPredictedDate,
                maintNotes,
                setMaintNotes,
                docVehicle,
                setDocVehicle,
                docType,
                setDocType,
                docNumber,
                setDocNumber,
                docExpiry,
                setDocExpiry,
                centerName,
                setCenterName,
                centerPhone,
                setCenterPhone,
                centerAddress,
                setCenterAddress,
                bookingVehicle,
                setBookingVehicle,
                bookingCenter,
                setBookingCenter,
                bookingDate,
                setBookingDate,
                bookingNotes,
                setBookingNotes,
                maintFeatures,
                setMaintFeatures,
                fuelFeatures,
                setFuelFeatures,
                maintResult,
                fuelResult,
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
                handleAddFuel,
                handleAddMaintenance,
                handleAddDocument,
                handleAddCenter,
                handleAddBooking,
                handlePredictMaintenance,
                handlePredictFuel,
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
