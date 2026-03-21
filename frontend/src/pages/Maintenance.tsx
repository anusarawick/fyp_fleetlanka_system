import { FormEvent, useEffect, useMemo, useState } from "react";

type Vehicle = {
  id: string;
  plate_no: string;
};

type MaintenanceRecord = {
  id: string;
  vehicle_id?: string;
  service_center_id?: string;
  service_booking_id?: string;
  service_date: string;
  service_type?: string;
  cost_lkr?: number;
  odometer_km?: number;
  next_service_due_km?: number;
  predicted_due_date?: string;
  notes?: string;
};

type ServiceCenter = {
  id: string;
  name: string;
  profile_id?: string;
  phone?: string;
  address?: string;
};

type ServiceBooking = {
  id: string;
  vehicle_id?: string;
  center_id?: string;
  requested_date: string;
  status?: string;
  notes?: string;
  service_notes?: string;
  completed_at?: string;
  final_cost_lkr?: number;
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
  editingMaintenanceId: string | null;
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
  bookingVehicle: string;
  setBookingVehicle: (v: string) => void;
  bookingCenter: string;
  setBookingCenter: (v: string) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  bookingNotes: string;
  setBookingNotes: (v: string) => void;
  editingBookingId: string | null;
  onAddMaintenance: (e: FormEvent) => void;
  onEditMaintenance: (record: MaintenanceRecord) => void;
  onCancelMaintenanceEdit: () => void;
  onDeleteMaintenance: (maintenanceId: string) => Promise<void>;
  onAddCenter: (e: FormEvent) => void;
  onEditCenter: (center: ServiceCenter) => void;
  onCancelCenterEdit: () => void;
  onDeleteCenter: (centerId: string) => Promise<void>;
  onAddBooking: (e: FormEvent) => void;
  onEditBooking: (booking: ServiceBooking) => void;
  onCancelBookingEdit: () => void;
  onDeleteBooking: (bookingId: string) => Promise<void>;
};

export default function Maintenance(props: MaintenanceProps) {
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [maintenanceRowsPerPage, setMaintenanceRowsPerPage] = useState(10);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [centerSearch, setCenterSearch] = useState("");
  const [centerRowsPerPage, setCenterRowsPerPage] = useState(10);
  const [centerPage, setCenterPage] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(null);
  const [deleteCenterTarget, setDeleteCenterTarget] = useState<ServiceCenter | null>(null);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingRowsPerPage, setBookingRowsPerPage] = useState(10);
  const [bookingPage, setBookingPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [deleteBookingTarget, setDeleteBookingTarget] = useState<ServiceBooking | null>(null);

  const totalCost = props.maintenance.reduce((sum, m) => sum + (m.cost_lkr || 0), 0);

  const vehicleLabelMap = useMemo(
    () =>
      props.vehicles.reduce<Record<string, string>>((acc, vehicle) => {
        acc[vehicle.id] = vehicle.plate_no;
        return acc;
      }, {}),
    [props.vehicles]
  );

  const centerLabelMap = useMemo(
    () =>
      props.centers.reduce<Record<string, string>>((acc, center) => {
        acc[center.id] = center.name;
        return acc;
      }, {}),
    [props.centers]
  );

  const filteredMaintenance = props.maintenance.filter((record) => {
    const query = maintenanceSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      record.service_date,
      record.service_type,
      record.predicted_due_date,
      record.notes,
      record.service_booking_id ? "service booking" : "manual",
      record.service_center_id ? centerLabelMap[record.service_center_id] : "",
      record.vehicle_id ? vehicleLabelMap[record.vehicle_id] : "",
      typeof record.cost_lkr === "number" ? String(record.cost_lkr) : "",
      typeof record.next_service_due_km === "number" ? String(record.next_service_due_km) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const maintenanceTotalPages = Math.max(
    1,
    Math.ceil(filteredMaintenance.length / maintenanceRowsPerPage)
  );
  const currentMaintenancePage = Math.min(maintenancePage, maintenanceTotalPages);
  const paginatedMaintenance = filteredMaintenance.slice(
    (currentMaintenancePage - 1) * maintenanceRowsPerPage,
    currentMaintenancePage * maintenanceRowsPerPage
  );

  const filteredCenters = props.centers.filter((center) => {
    const query = centerSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      center.name,
      center.phone,
      center.address,
      center.profile_id ? "portal linked" : "portal not linked",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const centerTotalPages = Math.max(1, Math.ceil(filteredCenters.length / centerRowsPerPage));
  const currentCenterPage = Math.min(centerPage, centerTotalPages);
  const paginatedCenters = filteredCenters.slice(
    (currentCenterPage - 1) * centerRowsPerPage,
    currentCenterPage * centerRowsPerPage
  );

  const filteredBookings = props.bookings.filter((booking) => {
    const query = bookingSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      booking.requested_date,
      booking.status,
      booking.notes,
      booking.service_notes,
      booking.vehicle_id ? vehicleLabelMap[booking.vehicle_id] : "",
      booking.center_id ? centerLabelMap[booking.center_id] : "",
      typeof booking.final_cost_lkr === "number" ? String(booking.final_cost_lkr) : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const bookingTotalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingRowsPerPage));
  const currentBookingPage = Math.min(bookingPage, bookingTotalPages);
  const paginatedBookings = filteredBookings.slice(
    (currentBookingPage - 1) * bookingRowsPerPage,
    currentBookingPage * bookingRowsPerPage
  );
  const upcomingBookings = props.bookings
    .filter((booking) => {
      const status = booking.status || "pending";
      return status === "pending" || status === "confirmed";
    })
    .slice(0, 4);

  useEffect(() => {
    setMaintenancePage(1);
  }, [maintenanceRowsPerPage, maintenanceSearch, props.maintenance.length]);

  useEffect(() => {
    setCenterPage(1);
  }, [centerRowsPerPage, centerSearch, props.centers.length]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingRowsPerPage, bookingSearch, props.bookings.length]);

  useEffect(() => {
    if (!props.loading) {
      setShowMaintenanceModal(false);
      setShowCenterModal(false);
      setShowBookingModal(false);
    }
  }, [props.loading]);

  function closeMaintenanceModal() {
    setShowMaintenanceModal(false);
    if (props.editingMaintenanceId) {
      props.onCancelMaintenanceEdit();
    }
  }

  function closeCenterModal() {
    setShowCenterModal(false);
    props.onCancelCenterEdit();
  }

  function closeBookingModal() {
    setShowBookingModal(false);
    props.onCancelBookingEdit();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await props.onDeleteMaintenance(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function confirmCenterDelete() {
    if (!deleteCenterTarget) return;
    await props.onDeleteCenter(deleteCenterTarget.id);
    setDeleteCenterTarget(null);
  }

  async function confirmBookingDelete() {
    if (!deleteBookingTarget) return;
    await props.onDeleteBooking(deleteBookingTarget.id);
    setDeleteBookingTarget(null);
  }

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
          <div className="stat-icon">Rs</div>
          <div className="stat-value">{totalCost.toLocaleString()}</div>
          <div className="stat-label">Total Maintenance Cost</div>
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <div className="card__header">
            <h3>Maintenance Actions</h3>
          </div>
          <p className="muted">
            Log service work, register centers, and create bookings from focused pop-up forms.
          </p>
          <div className="button-row maintenance-actions__row">
            <button
              className="btn maintenance-actions__btn"
              type="button"
              onClick={() => {
                props.onCancelMaintenanceEdit();
                setShowMaintenanceModal(true);
              }}
            >
              + Log Maintenance
            </button>
            <button
              className="btn maintenance-actions__btn"
              type="button"
              onClick={() => {
                props.onCancelCenterEdit();
                setShowCenterModal(true);
              }}
            >
              + Add Center
            </button>
            <button
              className="btn maintenance-actions__btn"
              type="button"
              onClick={() => {
                props.onCancelBookingEdit();
                setShowBookingModal(true);
              }}
            >
              + Book Service
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h3>Upcoming Bookings</h3>
          </div>
          {upcomingBookings.length === 0 ? (
            <p className="empty">No upcoming service bookings.</p>
          ) : (
            <ul className="list">
              {upcomingBookings.map((booking) => (
                <li key={booking.id}>
                  <div className="list__title">
                    {vehicleLabelMap[booking.vehicle_id || ""] || "Vehicle"} • {booking.requested_date}
                  </div>
                  <div className="list__meta">
                    {centerLabelMap[booking.center_id || ""] || "Service center"}{" "}
                    <span className={`pill pill--${booking.status === "confirmed" ? "info" : "warning"}`}>
                      {booking.status || "Pending"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>Maintenance History</h3>
        </div>
        {props.maintenance.length === 0 ? (
          <p className="empty">No maintenance records yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Date, type, vehicle..."
                    value={maintenanceSearch}
                    onChange={(e) => setMaintenanceSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={maintenanceRowsPerPage}
                    onChange={(e) => setMaintenanceRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentMaintenancePage} of {maintenanceTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setMaintenancePage((prev) => Math.max(1, prev - 1))}
                  disabled={currentMaintenancePage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setMaintenancePage((prev) => Math.min(maintenanceTotalPages, prev + 1))}
                  disabled={currentMaintenancePage === maintenanceTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredMaintenance.length === 0 ? (
              <p className="empty">No maintenance records match the search.</p>
            ) : (
              <div className="table maintenance-table" style={{ ["--table-columns" as any]: 6 }}>
                <div className="table__head maintenance-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Service</span>
                  <span>Source</span>
                  <span>Cost</span>
                  <span>Actions</span>
                </div>
                {paginatedMaintenance.map((record) => (
                  <div className="table__row maintenance-table__row" key={record.id}>
                    <span className="maintenance-table__cell" data-label="Date">{record.service_date}</span>
                    <span className="maintenance-table__cell" data-label="Vehicle">
                      {vehicleLabelMap[record.vehicle_id || ""] || "--"}
                    </span>
                    <span className="maintenance-table__cell" data-label="Service">{record.service_type || "Service"}</span>
                    <span className="maintenance-table__cell" data-label="Source">
                      <span className={`pill ${record.service_booking_id ? "pill--info" : "pill--warning"}`}>
                        {record.service_booking_id ? "Service Booking" : "Manual"}
                      </span>
                    </span>
                    <span className="maintenance-table__cell" data-label="Cost">
                      {typeof record.cost_lkr === "number" ? `Rs.${record.cost_lkr.toLocaleString()}` : "--"}
                    </span>
                    <span className="table__actions maintenance-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        aria-label={`View maintenance ${record.id}`}
                        title="View record"
                      >
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditMaintenance(record);
                          setShowMaintenanceModal(true);
                        }}
                        aria-label={`Edit maintenance ${record.id}`}
                        title="Edit record"
                      >
                        <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4.5 19.5h3.75L18.75 9 15 5.25 4.5 15.75v3.75Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.5 6.75 17.25 10.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteTarget(record)}
                        disabled={props.loading}
                        aria-label={`Delete maintenance ${record.id}`}
                        title="Delete record"
                      >
                        <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9.75 9.75v6.75M14.25 9.75v6.75M5.25 6.75h13.5M8.25 6.75V5.25A1.5 1.5 0 0 1 9.75 3.75h4.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-9.75 0 .6 10.2A1.5 1.5 0 0 0 8.1 18.75h7.8a1.5 1.5 0 0 0 1.497-1.8l-.597-10.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid" style={{ marginTop: "24px" }}>
        <section className="card">
          <div className="card__header">
            <h3>Registered Centers</h3>
          </div>
          {props.centers.length === 0 ? (
            <p className="empty">No service centers added yet.</p>
          ) : (
            <>
              <div className="table-controls">
                <div className="table-controls__filters">
                  <label className="table-controls__label table-controls__label--search">
                    Search
                    <input
                      type="search"
                      placeholder="Center, phone, address..."
                      value={centerSearch}
                      onChange={(e) => setCenterSearch(e.target.value)}
                    />
                  </label>
                  <label className="table-controls__label">
                    Rows
                    <select
                      value={centerRowsPerPage}
                      onChange={(e) => setCenterRowsPerPage(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
                <div className="table-pagination">
                  <span className="table-pagination__meta">
                    Page {currentCenterPage} of {centerTotalPages}
                  </span>
                  <button
                    className="btn btn--secondary btn--compact"
                    type="button"
                    onClick={() => setCenterPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentCenterPage === 1}
                  >
                    Prev
                  </button>
                  <button
                    className="btn btn--secondary btn--compact"
                    type="button"
                    onClick={() => setCenterPage((prev) => Math.min(centerTotalPages, prev + 1))}
                    disabled={currentCenterPage === centerTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
              {filteredCenters.length === 0 ? (
                <p className="empty">No service centers match the search.</p>
              ) : (
                <div className="table centers-table" style={{ ["--table-columns" as any]: 4 }}>
                  <div className="table__head centers-table__head">
                    <span>Center</span>
                    <span>Phone</span>
                    <span>Portal</span>
                    <span>Actions</span>
                  </div>
                  {paginatedCenters.map((center) => (
                    <div className="table__row centers-table__row" key={center.id}>
                      <span className="centers-table__cell" data-label="Center">{center.name}</span>
                      <span className="centers-table__cell" data-label="Phone">{center.phone || "--"}</span>
                      <span className="centers-table__cell" data-label="Portal">
                        <span className={`pill pill--${center.profile_id ? "success" : "warning"}`}>
                          {center.profile_id ? "Linked" : "Not Linked"}
                        </span>
                      </span>
                      <span className="table__actions centers-table__actions" data-label="Actions">
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => setSelectedCenter(center)}
                          aria-label={`View center ${center.name}`}
                          title="View center"
                        >
                          <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                          </svg>
                        </button>
                        <button
                          className="icon-action"
                          type="button"
                          onClick={() => {
                            props.onEditCenter(center);
                            setShowCenterModal(true);
                          }}
                          aria-label={`Edit center ${center.name}`}
                          title="Edit center"
                        >
                          <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M4.5 19.5h3.75L18.75 9 15 5.25 4.5 15.75v3.75Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M13.5 6.75 17.25 10.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          className="icon-action icon-action--danger"
                          type="button"
                          onClick={() => setDeleteCenterTarget(center)}
                          disabled={props.loading}
                          aria-label={`Delete center ${center.name}`}
                          title="Delete center"
                        >
                          <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M9.75 9.75v6.75M14.25 9.75v6.75M5.25 6.75h13.5M8.25 6.75V5.25A1.5 1.5 0 0 1 9.75 3.75h4.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-9.75 0 .6 10.2A1.5 1.5 0 0 0 8.1 18.75h7.8a1.5 1.5 0 0 0 1.497-1.8l-.597-10.2"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card__header">
          <h3>Service Bookings</h3>
        </div>
        {props.bookings.length === 0 ? (
          <p className="empty">No service bookings yet.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="table-controls__filters">
                <label className="table-controls__label table-controls__label--search">
                  Search
                  <input
                    type="search"
                    placeholder="Date, vehicle, center..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                  />
                </label>
                <label className="table-controls__label">
                  Rows
                  <select
                    value={bookingRowsPerPage}
                    onChange={(e) => setBookingRowsPerPage(Number(e.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="table-pagination">
                <span className="table-pagination__meta">
                  Page {currentBookingPage} of {bookingTotalPages}
                </span>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setBookingPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentBookingPage === 1}
                >
                  Prev
                </button>
                <button
                  className="btn btn--secondary btn--compact"
                  type="button"
                  onClick={() => setBookingPage((prev) => Math.min(bookingTotalPages, prev + 1))}
                  disabled={currentBookingPage === bookingTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
            {filteredBookings.length === 0 ? (
              <p className="empty">No bookings match the search.</p>
            ) : (
              <div className="table bookings-table" style={{ ["--table-columns" as any]: 5 }}>
                <div className="table__head bookings-table__head">
                  <span>Date</span>
                  <span>Vehicle</span>
                  <span>Center</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {paginatedBookings.map((booking) => (
                  <div className="table__row bookings-table__row" key={booking.id}>
                    <span className="bookings-table__cell" data-label="Date">{booking.requested_date}</span>
                    <span className="bookings-table__cell" data-label="Vehicle">
                      {vehicleLabelMap[booking.vehicle_id || ""] || "--"}
                    </span>
                    <span className="bookings-table__cell" data-label="Center">
                      {centerLabelMap[booking.center_id || ""] || "--"}
                    </span>
                    <span className="bookings-table__cell" data-label="Status">
                      <span className={`pill pill--${booking.status === "completed" ? "success" : booking.status === "cancelled" ? "danger" : booking.status === "confirmed" ? "info" : "warning"}`}>
                        {booking.status || "pending"}
                      </span>
                    </span>
                    <span className="table__actions bookings-table__actions" data-label="Actions">
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        aria-label={`View booking ${booking.id}`}
                        title="View booking"
                      >
                        <svg className="icon-action__svg icon-action__svg--view" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
                        </svg>
                      </button>
                      <button
                        className="icon-action"
                        type="button"
                        onClick={() => {
                          props.onEditBooking(booking);
                          setShowBookingModal(true);
                        }}
                        disabled={(booking.status || "pending") !== "pending"}
                        aria-label={`Edit booking ${booking.id}`}
                        title="Edit booking"
                      >
                        <svg className="icon-action__svg icon-action__svg--edit" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4.5 19.5h3.75L18.75 9 15 5.25 4.5 15.75v3.75Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M13.5 6.75 17.25 10.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        className="icon-action icon-action--danger"
                        type="button"
                        onClick={() => setDeleteBookingTarget(booking)}
                        disabled={props.loading || (booking.status || "pending") !== "pending"}
                        aria-label={`Delete booking ${booking.id}`}
                        title="Delete booking"
                      >
                        <svg className="icon-action__svg icon-action__svg--delete" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9.75 9.75v6.75M14.25 9.75v6.75M5.25 6.75h13.5M8.25 6.75V5.25A1.5 1.5 0 0 1 9.75 3.75h4.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-9.75 0 .6 10.2A1.5 1.5 0 0 0 8.1 18.75h7.8a1.5 1.5 0 0 0 1.497-1.8l-.597-10.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {showMaintenanceModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal modal--wide" role="dialog" aria-modal="true" aria-label="Maintenance form">
            <div className="modal__header">
              <div>
                <h3>{props.editingMaintenanceId ? "Edit Maintenance" : "Log Maintenance"}</h3>
                <p className="modal__subtle">
                  {props.editingMaintenanceId
                    ? "Update the selected service record without leaving the table view."
                    : "Create a service record without leaving the table view."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeMaintenanceModal} aria-label="Close maintenance form">
                ✕
              </button>
            </div>
            <form className="form form--two-col form--scroll" onSubmit={props.onAddMaintenance}>
              <label>
                Vehicle
                <select
                  value={props.maintVehicle}
                  onChange={(e) => props.setMaintVehicle(e.target.value)}
                  required
                >
                  <option value="">Select a vehicle</option>
                  {props.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no}
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
                  placeholder="e.g., Oil Change"
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
                Predicted Due Date
                <input
                  type="date"
                  value={props.maintPredictedDate}
                  onChange={(e) => props.setMaintPredictedDate(e.target.value)}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Notes
                <textarea
                  placeholder="Additional details..."
                  value={props.maintNotes}
                  onChange={(e) => props.setMaintNotes(e.target.value)}
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={closeMaintenanceModal}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={props.loading}>
                  {props.loading ? "Saving..." : props.editingMaintenanceId ? "Save Changes" : "Add Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCenterModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Service center form">
            <div className="modal__header">
              <div>
                <h3>{props.editingCenterId ? "Edit Service Center" : "Add Service Center"}</h3>
                <p className="modal__subtle">
                  {props.editingCenterId
                    ? "Update workshop details and optional portal credentials."
                    : "Register a workshop or service partner."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeCenterModal} aria-label="Close center form">
                ✕
              </button>
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
              <label>
                Portal Email
                <input
                  type="email"
                  placeholder={props.editingCenterId ? "Leave blank to keep current email" : "Optional service portal login"}
                  value={props.centerPortalEmail}
                  onChange={(e) => props.setCenterPortalEmail(e.target.value)}
                />
              </label>
              <label>
                Portal Password
                <input
                  type="password"
                  placeholder={props.editingCenterId ? "Leave blank to keep current password" : "Optional initial password"}
                  value={props.centerPortalPassword}
                  onChange={(e) => props.setCenterPortalPassword(e.target.value)}
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={closeCenterModal}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={props.loading}>
                  {props.loading ? "Saving..." : props.editingCenterId ? "Save Changes" : "Add Center"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBookingModal && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Service booking form">
            <div className="modal__header">
              <div>
                <h3>{props.editingBookingId ? "Edit Service Booking" : "Book Service"}</h3>
                <p className="modal__subtle">
                  {props.editingBookingId
                    ? "Update the selected booking without leaving the table view."
                    : "Schedule a vehicle with a registered center."}
                </p>
              </div>
              <button className="modal__close" type="button" onClick={closeBookingModal} aria-label="Close booking form">
                ✕
              </button>
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
                  {props.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate_no}
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
                  {props.centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
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
              <div className="modal__actions">
                <button className="btn btn--secondary" type="button" onClick={closeBookingModal}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={props.loading}>
                  {props.loading ? "Saving..." : props.editingBookingId ? "Save Changes" : "Book Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Maintenance record details">
            <div className="modal__header">
              <div>
                <h3>Maintenance Record</h3>
                <p className="modal__subtle">Read-only view of the selected maintenance entry.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedRecord(null)} aria-label="Close maintenance details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Date</span><strong>{selectedRecord.service_date}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedRecord.vehicle_id || ""] || "--"}</strong></div>
              <div className="detail-item"><span>Service</span><strong>{selectedRecord.service_type || "--"}</strong></div>
              <div className="detail-item"><span>Source</span><strong>{selectedRecord.service_booking_id ? "Service Booking" : "Manual"}</strong></div>
              <div className="detail-item"><span>Cost</span><strong>{typeof selectedRecord.cost_lkr === "number" ? `Rs.${selectedRecord.cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Service Center</span><strong>{selectedRecord.service_center_id ? centerLabelMap[selectedRecord.service_center_id] || "--" : "--"}</strong></div>
              <div className="detail-item"><span>Odometer</span><strong>{selectedRecord.odometer_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Next Due (km)</span><strong>{selectedRecord.next_service_due_km ?? "--"}</strong></div>
              <div className="detail-item"><span>Predicted Due Date</span><strong>{selectedRecord.predicted_due_date || "--"}</strong></div>
              <div className="detail-item"><span>Linked Booking</span><strong>{selectedRecord.service_booking_id || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Notes</span><strong>{selectedRecord.notes || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {selectedCenter && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Service center details">
            <div className="modal__header">
              <div>
                <h3>Service Center</h3>
                <p className="modal__subtle">Read-only view of the selected service center.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedCenter(null)} aria-label="Close center details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Name</span><strong>{selectedCenter.name}</strong></div>
              <div className="detail-item"><span>Phone</span><strong>{selectedCenter.phone || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Address</span><strong>{selectedCenter.address || "--"}</strong></div>
              <div className="detail-item"><span>Portal Status</span><strong>{selectedCenter.profile_id ? "Linked" : "Not Linked"}</strong></div>
              <div className="detail-item"><span>Center ID</span><strong>{selectedCenter.id}</strong></div>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Service booking details">
            <div className="modal__header">
              <div>
                <h3>Service Booking</h3>
                <p className="modal__subtle">Read-only view of the selected booking.</p>
              </div>
              <button className="modal__close" type="button" onClick={() => setSelectedBooking(null)} aria-label="Close booking details">
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="detail-item"><span>Date</span><strong>{selectedBooking.requested_date}</strong></div>
              <div className="detail-item"><span>Status</span><strong>{selectedBooking.status || "pending"}</strong></div>
              <div className="detail-item"><span>Vehicle</span><strong>{vehicleLabelMap[selectedBooking.vehicle_id || ""] || "--"}</strong></div>
              <div className="detail-item"><span>Center</span><strong>{centerLabelMap[selectedBooking.center_id || ""] || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Booking Notes</span><strong>{selectedBooking.notes || "--"}</strong></div>
              <div className="detail-item detail-item--full"><span>Service Notes</span><strong>{selectedBooking.service_notes || "--"}</strong></div>
              <div className="detail-item"><span>Final Cost</span><strong>{typeof selectedBooking.final_cost_lkr === "number" ? `Rs.${selectedBooking.final_cost_lkr.toLocaleString()}` : "--"}</strong></div>
              <div className="detail-item"><span>Completed At</span><strong>{selectedBooking.completed_at || "--"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm delete">
            <div className="modal__header">
              <h3>Delete Maintenance Record?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this maintenance record for <strong>{vehicleLabelMap[deleteTarget.vehicle_id || ""] || "Vehicle"}</strong>? This action cannot be undone.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmDelete} disabled={props.loading}>
                {props.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCenterTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm center delete">
            <div className="modal__header">
              <h3>Delete Service Center?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteCenterTarget(null)} aria-label="Close center delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete <strong>{deleteCenterTarget.name}</strong>? Any linked service-center login will also be removed.
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteCenterTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmCenterDelete} disabled={props.loading}>
                {props.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteBookingTarget && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm booking delete">
            <div className="modal__header">
              <h3>Delete Service Booking?</h3>
              <button className="modal__close" type="button" onClick={() => setDeleteBookingTarget(null)} aria-label="Close booking delete dialog">
                ✕
              </button>
            </div>
            <p className="muted">
              Are you sure you want to delete this service booking for <strong>{vehicleLabelMap[deleteBookingTarget.vehicle_id || ""] || "Vehicle"}</strong>?
            </p>
            <div className="modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setDeleteBookingTarget(null)}>
                Cancel
              </button>
              <button className="btn btn--danger" type="button" onClick={confirmBookingDelete} disabled={props.loading}>
                {props.loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
