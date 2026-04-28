import { Vehicle, FuelLog, Maintenance, Driver, Trip, Document } from "../types";

export const exportCSV = (filename: string, rows: Array<Array<string | undefined>>) => {
    const csv = rows.map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const exportFuel = (fuelLogs: FuelLog[]) => {
    const rows = [
        ["fuel_date", "liters", "cost_lkr", "odometer_km", "vendor", "vehicle_id"],
        ...fuelLogs.map((f) => [
            f.fuel_date,
            String(f.liters),
            String(f.cost_lkr || 0),
            String(f.odometer_km || ""),
            f.vendor || "",
            f.vehicle_id,
        ]),
    ];
    exportCSV("fuel_logs.csv", rows);
};

export const exportMaintenance = (maintenance: Maintenance[]) => {
    const rows = [
        ["service_date", "service_type", "cost_lkr", "odometer_km", "service_center_id", "source", "predicted_due_date", "vehicle_id"],
        ...maintenance.map((m) => [
            m.service_date,
            m.service_type || "",
            String(m.cost_lkr || 0),
            String(m.odometer_km || ""),
            m.service_center_id || "",
            m.service_booking_id ? "Service Booking" : "Manual",
            m.predicted_due_date || "",
            m.vehicle_id,
        ]),
    ];
    exportCSV("maintenance.csv", rows);
};

export const exportVehicles = (vehicles: Vehicle[]) => {
    const rows = [
        ["plate_no", "make", "model", "vehicle_type", "year", "status", "odometer_km", "maintenance_history"],
        ...vehicles.map((v) => [
            v.plate_no,
            v.make || "",
            v.model || "",
            v.vehicle_type || "",
            String(v.year || ""),
            v.status || "",
            String(v.odometer_km || ""),
            v.maintenance_history || "",
        ]),
    ];
    exportCSV("vehicles.csv", rows);
};

export const exportDrivers = (drivers: Driver[]) => {
    const rows = [
        ["full_name", "email", "phone", "status", "role"],
        ...drivers.map((d) => [d.full_name || "", d.email || "", d.phone || "", d.status || "", d.role || ""]),
    ];
    exportCSV("drivers.csv", rows);
};

export const exportTrips = (trips: Trip[]) => {
    const rows = [
        ["start_time", "end_time", "distance_km", "duration_min", "avg_speed_kmh", "idle_min", "vehicle_id"],
        ...trips.map((t) => [
            t.start_time || "",
            t.end_time || "",
            String(t.distance_km || ""),
            String(t.duration_min || ""),
            String(t.avg_speed_kmh || ""),
            String(t.idle_min || ""),
            t.vehicle_id,
        ]),
    ];
    exportCSV("trips.csv", rows);
};

export const exportDocuments = (documents: Document[]) => {
    const rows = [
        ["doc_type", "doc_number", "expiry_date", "owner_type", "vehicle_id", "driver_id", "file_url"],
        ...documents.map((d) => [
            d.doc_type,
            d.doc_number || "",
            d.expiry_date || "",
            d.driver_id ? "Driver" : "Vehicle",
            d.vehicle_id || "",
            d.driver_id || "",
            d.file_url || "",
        ]),
    ];
    exportCSV("documents.csv", rows);
};

export const parseFeatureLines = (raw: string) => {
    return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(",").map((v) => Number(v.trim())));
};
