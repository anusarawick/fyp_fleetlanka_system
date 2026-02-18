import { Vehicle, FuelLog, Maintenance, Driver, Trip, Document } from "../types";

export const exportCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
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
        ["fuel_date", "liters", "cost_lkr", "vehicle_id"],
        ...fuelLogs.map((f) => [
            f.fuel_date,
            String(f.liters),
            String(f.cost_lkr || 0),
            f.vehicle_id,
        ]),
    ];
    exportCSV("fuel_logs.csv", rows);
};

export const exportMaintenance = (maintenance: Maintenance[]) => {
    const rows = [
        ["service_date", "predicted_due_date"],
        ...maintenance.map((m) => [m.service_date, m.predicted_due_date || ""]),
    ];
    exportCSV("maintenance.csv", rows);
};

export const exportVehicles = (vehicles: Vehicle[]) => {
    const rows = [
        ["plate_no", "make", "model", "year"],
        ...vehicles.map((v) => [
            v.plate_no,
            v.make || "",
            v.model || "",
            String(v.year || ""),
        ]),
    ];
    exportCSV("vehicles.csv", rows);
};

export const exportDrivers = (drivers: Driver[]) => {
    const rows = [
        ["full_name", "phone", "role"],
        ...drivers.map((d) => [d.full_name || "", d.phone || "", d.role || ""]),
    ];
    exportCSV("drivers.csv", rows);
};

export const exportTrips = (trips: Trip[]) => {
    const rows = [
        ["start_time", "end_time", "distance_km"],
        ...trips.map((t) => [
            t.start_time,
            t.end_time || "",
            String(t.distance_km || ""),
        ]),
    ];
    exportCSV("trips.csv", rows);
};

export const exportDocuments = (documents: Document[]) => {
    const rows = [
        ["doc_type", "doc_number", "expiry_date"],
        ...documents.map((d) => [
            d.doc_type,
            d.doc_number || "",
            d.expiry_date || "",
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
