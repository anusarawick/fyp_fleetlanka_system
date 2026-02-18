import { FormEvent } from "react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type MaintenanceRecord = {
  id: string;
  service_date: string;
  service_type?: string;
  cost_lkr?: number;
};

type ServiceCenter = {
  id: string;
  name: string;
};

type ServiceBooking = {
  id: string;
  requested_date: string;
  status?: string;
};

type MaintenanceProps = {
  vehicles: Vehicle[];
  maintenance: MaintenanceRecord[];
  centers: ServiceCenter[];
  bookings: ServiceBooking[];
  loading: boolean;
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
  centerName: string;
  setCenterName: (v: string) => void;
  centerPhone: string;
  setCenterPhone: (v: string) => void;
  centerAddress: string;
  setCenterAddress: (v: string) => void;
  bookingVehicle: string;
  setBookingVehicle: (v: string) => void;
  bookingCenter: string;
  setBookingCenter: (v: string) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  bookingNotes: string;
  setBookingNotes: (v: string) => void;
  onAddMaintenance: (e: FormEvent) => void;
  onAddCenter: (e: FormEvent) => void;
  onAddBooking: (e: FormEvent) => void;
};

export default function Maintenance(props: MaintenanceProps) {
  const totalCost = props.maintenance.reduce((sum, m) => sum + (m.cost_lkr || 0), 0);

  return (
    <section className="section">
      <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-icon">🔧</div>
          <div className="stat-value">{props.maintenance.length}</div>
          <div className="stat-label">Service Records</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏪</div>
          <div className="stat-value">{props.centers.length}</div>
          <div className="stat-label">Service Centers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{props.bookings.length}</div>
          <div className="stat-label">Active Bookings</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>🔧 Log Maintenance</h3>
          </div>
          <form className="form" onSubmit={props.onAddMaintenance}>
            <label>
              Vehicle
              <select
                value={props.maintVehicle}
                onChange={(e) => props.setMaintVehicle(e.target.value)}
                required
              >
                <option value="">Select a vehicle</option>
                {props.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service Date
              <input
                type="date"
                value={props.maintDate}
                onChange={(e) => props.setMaintDate(e.target.value)}
                required
              />
            </label>
            <label>
              Service Type
              <input
                placeholder="e.g., Oil Change, Brake Service"
                value={props.maintType}
                onChange={(e) => props.setMaintType(e.target.value)}
              />
            </label>
            <label>
              Cost (LKR)
              <input
                type="number"
                placeholder="e.g., 25000"
                value={props.maintCost}
                onChange={(e) => props.setMaintCost(e.target.value)}
              />
            </label>
            <label>
              Odometer (km)
              <input
                type="number"
                placeholder="Current reading"
                value={props.maintOdometer}
                onChange={(e) => props.setMaintOdometer(e.target.value)}
              />
            </label>
            <label>
              Next Service Due (km)
              <input
                type="number"
                placeholder="e.g., 55000"
                value={props.maintNextDue}
                onChange={(e) => props.setMaintNextDue(e.target.value)}
              />
            </label>
            <label>
              Notes
              <textarea
                placeholder="Additional details..."
                value={props.maintNotes}
                onChange={(e) => props.setMaintNotes(e.target.value)}
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : "+ Add Record"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>📋 Maintenance History</h3>
            {props.maintenance.length > 0 && (
              <span className="pill">{props.maintenance.length}</span>
            )}
          </div>
          {props.maintenance.length === 0 ? (
            <p className="empty">No maintenance records yet</p>
          ) : (
            <ul className="list">
              {props.maintenance.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <div className="list__title">{m.service_type || "Service"}</div>
                  <div className="list__meta">
                    {m.service_date} {m.cost_lkr && `• Rs.${m.cost_lkr.toLocaleString()}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <h3>🏪 Add Service Center</h3>
          </div>
          <form className="form" onSubmit={props.onAddCenter}>
            <label>
              Center Name
              <input
                placeholder="e.g., Toyota Lanka - Colombo"
                value={props.centerName}
                onChange={(e) => props.setCenterName(e.target.value)}
                required
              />
            </label>
            <label>
              Phone Number
              <input
                placeholder="e.g., 011-2345678"
                value={props.centerPhone}
                onChange={(e) => props.setCenterPhone(e.target.value)}
              />
            </label>
            <label>
              Address
              <input
                placeholder="e.g., 123 Galle Road, Colombo 03"
                value={props.centerAddress}
                onChange={(e) => props.setCenterAddress(e.target.value)}
              />
            </label>
            <button className="btn btn--secondary" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : "+ Add Center"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>📅 Book Service</h3>
          </div>
          <form className="form" onSubmit={props.onAddBooking}>
            <label>
              Vehicle
              <select
                value={props.bookingVehicle}
                onChange={(e) => props.setBookingVehicle(e.target.value)}
                required
              >
                <option value="">Select a vehicle</option>
                {props.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service Center
              <select
                value={props.bookingCenter}
                onChange={(e) => props.setBookingCenter(e.target.value)}
                required
              >
                <option value="">Select a center</option>
                {props.centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preferred Date
              <input
                type="date"
                value={props.bookingDate}
                onChange={(e) => props.setBookingDate(e.target.value)}
                required
              />
            </label>
            <label>
              Notes
              <input
                placeholder="Any special requests..."
                value={props.bookingNotes}
                onChange={(e) => props.setBookingNotes(e.target.value)}
              />
            </label>
            <button className="btn" type="submit" disabled={props.loading}>
              {props.loading ? "Saving..." : "Book Service"}
            </button>
          </form>

          {props.bookings.length > 0 && (
            <>
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <div className="card__header" style={{ marginBottom: "12px" }}>
                  <strong>Upcoming Bookings</strong>
                </div>
                <ul className="list">
                  {props.bookings.slice(0, 3).map((b) => (
                    <li key={b.id}>
                      <div className="list__title">{b.requested_date}</div>
                      <div className="list__meta">
                        <span className={`pill pill--${b.status === "confirmed" ? "success" : "warning"}`}>
                          {b.status || "Pending"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
