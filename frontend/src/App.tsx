import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import AppLayout from "./layout/AppLayout";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import DriverTrips from "./pages/Driver";
import Analytics from "./pages/Analytics";
import MLPredictions from "./pages/MLPredictions";
import Reports from "./pages/Reports";
import Compliance from "./pages/Compliance";
import Fuel from "./pages/Fuel";
import Management from "./pages/Management";
import Maintenance from "./pages/Maintenance";
import ProfileSettings from "./pages/ProfileSettings";
import Drivers from "./pages/Drivers";
import ServicePortal from "./pages/ServicePortal";
import TripsPage from "./pages/Trips";
import PublicHomePage from "./pages/PublicHomePage";
import { exportFuel, exportMaintenance } from "./utils/export";
import { useState } from "react";

const BRAND_LOGO_SRC = "/icons/fleetlanka-logo.png";

// ===== UNIFIED LOGIN / MANAGER SIGNUP =====
function AuthPortal({ initialSignup = false }: { initialSignup?: boolean }) {
  const { email, password, setEmail, setPassword, handleLogin, handleSignup, loading, error, setError } = useAuth();
  const [isSignup, setIsSignup] = useState(initialSignup);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    if (isSignup) {
      await handleSignup(e, name, orgName);
    } else {
      await handleLogin(e);
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <Link className="auth__back" to="/">← Back</Link>
        <div className="auth__header">
          <span className="auth__icon" aria-hidden="true">
            <img src={BRAND_LOGO_SRC} alt="" />
          </span>
          <h2>{isSignup ? "Create Manager Account" : "Sign in to FleetLanka"}</h2>
          <p className="muted">
            {isSignup
              ? "Create a manager workspace for your fleet operations."
              : "Enter your credentials to open your workspace."}
          </p>
        </div>

        {error && (
          <div className="alert alert--error">
            <span>{error}</span>
            <button className="alert__close" type="button" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <form className="form" onSubmit={onSubmit}>
          {isSignup && (
            <label>
              Full Name
              <input
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          {isSignup && (
            <label>
              Organization Name
              <input
                type="text"
                placeholder="FleetLanka Logistics"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email Address
            <input
              type="email"
              placeholder="user@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder={isSignup ? "Create a password" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 6 : undefined}
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading
              ? (isSignup ? "Creating account..." : "Signing in...")
              : (isSignup ? "Create manager account" : "Sign in")}
          </button>
        </form>

        <div className="auth__toggle">
          {isSignup ? (
            <p>
              Already have an account?{" "}
              <button type="button" onClick={() => setIsSignup(false)}>
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Need a manager workspace?{" "}
              <button type="button" onClick={() => setIsSignup(true)}>
                Create manager account
              </button>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LoadingScreen() {
  return (
    <section className="auth">
      <div className="auth__card">
        <h2>Loading...</h2>
        <p className="muted">Preparing your workspace.</p>
      </div>
    </section>
  );
}

function DriverRoutes() {
  const { handleSignOut } = useAuth();
  const {
    vehicles,
    trips,
    driverScore,
    driverScoreLabel,
    driverScoreBreakdown,
    activeTripId,
    tripTrackingStatus,
    tripTrackingLastUpdated,
    pendingTripSyncCount,
    pendingGpsPointCount,
    syncingTripQueue,
    pendingTripStatusById,
    startTrip,
    stopTrip,
    geoSupported,
  } = useData();
  const { loading } = useAuth();

  return (
    <DriverTrips
      vehicles={vehicles}
      trips={trips}
      loading={loading}
      activeTripId={activeTripId}
      tripTrackingStatus={tripTrackingStatus}
      tripTrackingLastUpdated={tripTrackingLastUpdated}
      pendingTripSyncCount={pendingTripSyncCount}
      pendingGpsPointCount={pendingGpsPointCount}
      syncingTripQueue={syncingTripQueue}
      pendingTripStatusById={pendingTripStatusById}
      driverScore={driverScore}
      driverScoreLabel={driverScoreLabel}
      driverScoreBreakdown={driverScoreBreakdown}
      startTrip={startTrip}
      stopTrip={stopTrip}
      geoSupported={geoSupported}
      onSignOut={handleSignOut}
    />
  );
}

function ManagerRoutes() {
  const { handleSignOut, loading, email, role, fullName, phone, handleUpdateProfile, handleChangePassword, profileLoading } = useAuth();
  const data = useData();

  // Extract user name from email (before @)
  const resolvedName = fullName || (email ? email.split("@")[0] : "Manager");
  const userName = resolvedName.split(" ")[0];
  const userRole = role || "manager";

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <>
            <Topbar
              title="Dashboard"
              subtitle="Manager overview"
              userName={userName}
              userRole={userRole}
              notificationCount={data.buildAlerts().length}
              onSignOut={handleSignOut}
            />
            <Dashboard
              vehicleCount={data.vehicles.length}
              activeTrips={data.activeTrips}
              fuelCostTotal={data.currency.format(data.fuelCostTotal)}
              maintenance={data.maintenance}
              vehicles={data.vehicles}
              driverScores={data.driverScores}
              serviceBookings={data.serviceBookings}
              topPerformers={data.topPerformers}
              maintenancePredictionMap={data.maintenancePredictionMap}
              liveTrips={data.liveTrips}
              documents={data.documents}
              upcomingDocs={data.upcomingDocs}
              fuelForecasts={data.fuelForecasts}
            />
          </>
        }
      />
      <Route
        path="/trips"
        element={
          <>
            <Topbar title="Trips" subtitle="Dispatch, route monitoring, and saved locations" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <TripsPage
              trips={data.trips}
              vehicles={data.vehicles}
              drivers={data.drivers}
              liveTrips={data.liveTrips}
              loading={loading}
              onCreateTripAssignment={data.handleCreateTripAssignment}
              onUpdateTripAssignment={data.handleUpdateTripAssignment}
              onDeleteTrip={data.handleDeleteTripRecord}
            />
          </>
        }
      />
      <Route
        path="/management"
        element={
          <>
            <Topbar title="Fleet Management" subtitle="Vehicles, service readiness, and maintenance risk" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Management
              vehicles={data.vehicles}
              maintenancePredictionMap={data.maintenancePredictionMap}
              loading={loading}
              plateNo={data.plateNo}
              setPlateNo={data.setPlateNo}
              make={data.make}
              setMake={data.setMake}
              model={data.model}
              setModel={data.setModel}
              vehicleType={data.vehicleType}
              setVehicleType={data.setVehicleType}
              year={data.year}
              setYear={data.setYear}
              vehicleStatus={data.vehicleStatus}
              setVehicleStatus={data.setVehicleStatus}
              vehicleMileage={data.vehicleMileage}
              setVehicleMileage={data.setVehicleMileage}
              vehicleOdometer={data.vehicleOdometer}
              setVehicleOdometer={data.setVehicleOdometer}
              transmissionType={data.transmissionType}
              setTransmissionType={data.setTransmissionType}
              engineSizeCc={data.engineSizeCc}
              setEngineSizeCc={data.setEngineSizeCc}
              accidentHistoryCount={data.accidentHistoryCount}
              setAccidentHistoryCount={data.setAccidentHistoryCount}
              fuelEfficiency={data.fuelEfficiency}
              setFuelEfficiency={data.setFuelEfficiency}
              maintenanceHistory={data.maintenanceHistory}
              setMaintenanceHistory={data.setMaintenanceHistory}
              reportedIssuesCount={data.reportedIssuesCount}
              setReportedIssuesCount={data.setReportedIssuesCount}
              tireCondition={data.tireCondition}
              setTireCondition={data.setTireCondition}
              brakeCondition={data.brakeCondition}
              setBrakeCondition={data.setBrakeCondition}
              batteryStatus={data.batteryStatus}
              setBatteryStatus={data.setBatteryStatus}
              fuelType={data.fuelType}
              setFuelType={data.setFuelType}
              businessType={data.businessType}
              setBusinessType={data.setBusinessType}
              roadConditionPrimary={data.roadConditionPrimary}
              setRoadConditionPrimary={data.setRoadConditionPrimary}
              driverBehaviorProfile={data.driverBehaviorProfile}
              setDriverBehaviorProfile={data.setDriverBehaviorProfile}
              expectedKmpl={data.expectedKmpl}
              setExpectedKmpl={data.setExpectedKmpl}
              typicalLoadFactor={data.typicalLoadFactor}
              setTypicalLoadFactor={data.setTypicalLoadFactor}
              serviceIntervalKm={data.serviceIntervalKm}
              setServiceIntervalKm={data.setServiceIntervalKm}
              oilIntervalKm={data.oilIntervalKm}
              setOilIntervalKm={data.setOilIntervalKm}
              tyreLifeKm={data.tyreLifeKm}
              setTyreLifeKm={data.setTyreLifeKm}
              brakeLifeKm={data.brakeLifeKm}
              setBrakeLifeKm={data.setBrakeLifeKm}
              batteryLifeMonths={data.batteryLifeMonths}
              setBatteryLifeMonths={data.setBatteryLifeMonths}
              fuelFilterIntervalKm={data.fuelFilterIntervalKm}
              setFuelFilterIntervalKm={data.setFuelFilterIntervalKm}
              lastServiceOdometerKm={data.lastServiceOdometerKm}
              setLastServiceOdometerKm={data.setLastServiceOdometerKm}
              lastOilChangeOdometerKm={data.lastOilChangeOdometerKm}
              setLastOilChangeOdometerKm={data.setLastOilChangeOdometerKm}
              lastTyreChangeOdometerKm={data.lastTyreChangeOdometerKm}
              setLastTyreChangeOdometerKm={data.setLastTyreChangeOdometerKm}
              lastBrakeServiceOdometerKm={data.lastBrakeServiceOdometerKm}
              setLastBrakeServiceOdometerKm={data.setLastBrakeServiceOdometerKm}
              lastFuelFilterChangeOdometerKm={data.lastFuelFilterChangeOdometerKm}
              setLastFuelFilterChangeOdometerKm={data.setLastFuelFilterChangeOdometerKm}
              batteryInstalledAt={data.batteryInstalledAt}
              setBatteryInstalledAt={data.setBatteryInstalledAt}
              activeTrips={data.activeTrips}
              editingVehicleId={data.editingVehicleId}
              onSaveVehicle={data.handleSaveVehicle}
              onEditVehicle={data.handleEditVehicle}
              onCancelEdit={data.handleCancelVehicleEdit}
              onDeleteVehicle={data.handleDeleteVehicle}
            />
          </>
        }
      />
      <Route
        path="/drivers"
        element={
          <>
            <Topbar title="Drivers" subtitle="Roster readiness and driver access" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Drivers
              drivers={data.drivers}
              trips={data.trips}
              driverInsights={data.driverInsights}
              loading={loading}
              driverName={data.driverName}
              setDriverName={data.setDriverName}
              driverEmail={data.driverEmail}
              setDriverEmail={data.setDriverEmail}
              driverPhone={data.driverPhone}
              setDriverPhone={data.setDriverPhone}
              driverStatus={data.driverStatus}
              setDriverStatus={data.setDriverStatus}
              driverPassword={data.driverPassword}
              setDriverPassword={data.setDriverPassword}
              editingDriverId={data.editingDriverId}
              onSaveDriver={data.handleSaveDriver}
              onEditDriver={data.handleEditDriver}
              onCancelEdit={data.handleCancelDriverEdit}
              onDeleteDriver={data.handleDeleteDriver}
            />
          </>
        }
      />
      <Route
        path="/fuel"
        element={
          <>
            <Topbar title="Fuel" subtitle="Spend, consumption, and fuel log control" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Fuel
              vehicles={data.vehicles}
              fuelLogs={data.fuelLogs}
              fuelForecasts={data.fuelForecasts}
              loading={loading}
              fuelVehicle={data.fuelVehicle}
              setFuelVehicle={data.setFuelVehicle}
              fuelDate={data.fuelDate}
              setFuelDate={data.setFuelDate}
              fuelLiters={data.fuelLiters}
              setFuelLiters={data.setFuelLiters}
              fuelCost={data.fuelCost}
              setFuelCost={data.setFuelCost}
              fuelOdometer={data.fuelOdometer}
              setFuelOdometer={data.setFuelOdometer}
              fuelVendor={data.fuelVendor}
              setFuelVendor={data.setFuelVendor}
              editingFuelId={data.editingFuelId}
              onExportFuel={() => exportFuel(data.fuelLogs)}
              onAddFuel={data.handleAddFuel}
              onEditFuel={data.handleEditFuel}
              onCancelFuelEdit={data.handleCancelFuelEdit}
              onDeleteFuel={data.handleDeleteFuel}
            />
          </>
        }
      />
      <Route
        path="/maintenance"
        element={
          <>
            <Topbar title="Maintenance" subtitle="Service records and bookings" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Maintenance
              vehicles={data.vehicles}
              maintenance={data.maintenance}
              centers={data.serviceCenters}
              bookings={data.serviceBookings}
              loading={loading}
              maintVehicle={data.maintVehicle}
              setMaintVehicle={data.setMaintVehicle}
              maintDate={data.maintDate}
              setMaintDate={data.setMaintDate}
              maintType={data.maintType}
              setMaintType={data.setMaintType}
              maintEventType={data.maintEventType}
              setMaintEventType={data.setMaintEventType}
              maintEventCategory={data.maintEventCategory}
              setMaintEventCategory={data.setMaintEventCategory}
              maintSeverity={data.maintSeverity}
              setMaintSeverity={data.setMaintSeverity}
              maintCost={data.maintCost}
              setMaintCost={data.setMaintCost}
              maintOdometer={data.maintOdometer}
              setMaintOdometer={data.setMaintOdometer}
              maintNextDue={data.maintNextDue}
              setMaintNextDue={data.setMaintNextDue}
              maintNotes={data.maintNotes}
              setMaintNotes={data.setMaintNotes}
              editingMaintenanceId={data.editingMaintenanceId}
              centerName={data.centerName}
              setCenterName={data.setCenterName}
              centerPhone={data.centerPhone}
              setCenterPhone={data.setCenterPhone}
              centerAddress={data.centerAddress}
              setCenterAddress={data.setCenterAddress}
              centerPortalEmail={data.centerPortalEmail}
              setCenterPortalEmail={data.setCenterPortalEmail}
              centerPortalPassword={data.centerPortalPassword}
              setCenterPortalPassword={data.setCenterPortalPassword}
              editingCenterId={data.editingCenterId}
              bookingVehicle={data.bookingVehicle}
              setBookingVehicle={data.setBookingVehicle}
              bookingCenter={data.bookingCenter}
              setBookingCenter={data.setBookingCenter}
              bookingDate={data.bookingDate}
              setBookingDate={data.setBookingDate}
              bookingNotes={data.bookingNotes}
              setBookingNotes={data.setBookingNotes}
              editingBookingId={data.editingBookingId}
              onAddMaintenance={data.handleAddMaintenance}
              onEditMaintenance={data.handleEditMaintenance}
              onCancelMaintenanceEdit={data.handleCancelMaintenanceEdit}
              onDeleteMaintenance={data.handleDeleteMaintenance}
              onAddCenter={data.handleAddCenter}
              onEditCenter={data.handleEditCenter}
              onCancelCenterEdit={data.handleCancelCenterEdit}
              onDeleteCenter={data.handleDeleteCenter}
              onAddBooking={data.handleAddBooking}
              onEditBooking={data.handleEditBooking}
              onCancelBookingEdit={data.handleCancelBookingEdit}
              onDeleteBooking={data.handleDeleteBooking}
              onApproveBookingCompletion={data.handleApproveBookingCompletion}
              onRejectBookingCompletion={data.handleRejectBookingCompletion}
            />
          </>
        }
      />
      <Route
        path="/documents"
        element={
          <>
            <Topbar title="Documents" subtitle="Renewals, ownership, and coverage" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Documents
              vehicles={data.vehicles}
              drivers={data.drivers}
              documents={data.documents}
              loading={loading}
              docOwnerType={data.docOwnerType}
              setDocOwnerType={data.setDocOwnerType}
              docVehicle={data.docVehicle}
              setDocVehicle={data.setDocVehicle}
              docDriver={data.docDriver}
              setDocDriver={data.setDocDriver}
              docType={data.docType}
              setDocType={data.setDocType}
              docNumber={data.docNumber}
              setDocNumber={data.setDocNumber}
              docExpiry={data.docExpiry}
              setDocExpiry={data.setDocExpiry}
              editingDocumentId={data.editingDocumentId}
              onAddDocument={data.handleAddDocument}
              onEditDocument={data.handleEditDocument}
              onCancelDocumentEdit={data.handleCancelDocumentEdit}
              onDeleteDocument={data.handleDeleteDocument}
            />
          </>
        }
      />
      <Route path="/driver" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/analytics"
        element={
          <>
            <Topbar title="Analytics" subtitle="Fleet performance and operating insight" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Analytics
              vehicles={data.vehicles}
              trips={data.trips}
              fuelLogs={data.fuelLogs}
              maintenance={data.maintenance}
              maintenancePredictionMap={data.maintenancePredictionMap}
              fuelCostTotal={data.fuelCostTotal}
              projectedFuelDemand={data.fuelForecasts.reduce(
                (sum, row) => sum + row.forecast_liters_7d,
                0
              )}
              avgFuelPerVehicle={
                data.vehicles.length > 0
                  ? data.fuelLogs.reduce((sum, f) => sum + f.liters, 0) /
                    data.vehicles.length
                  : 0
              }
              vehicleCount={data.vehicles.length}
              driverCount={data.drivers.length}
              activeTrips={data.activeTrips}
              topPerformers={data.topPerformers}
              onExportMaintenance={() => exportMaintenance(data.maintenance)}
            />
          </>
        }
      />
      <Route
        path="/ml"
        element={
          <>
            <Topbar title="ML Predictions" subtitle="Maintenance risk checks and history" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <MLPredictions
              vehicles={data.vehicles}
              maintenance={data.maintenance}
              mlVehicleId={data.mlVehicleId}
              setMlVehicleId={data.setMlVehicleId}
              maintenancePredictions={data.maintenancePredictions}
              maintenancePredictionMap={data.maintenancePredictionMap}
              loading={loading}
              onRunVehicleMaintenanceCheck={data.runVehicleMaintenanceCheck}
              onDeleteMaintenancePrediction={data.deleteMaintenancePrediction}
            />
          </>
        }
      />
      <Route
        path="/reports"
        element={
          <>
            <Topbar title="Reports" subtitle="Filtered exports and operational records" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Reports
              vehicles={data.vehicles}
              drivers={data.drivers}
              trips={data.trips}
              fuelLogs={data.fuelLogs}
              maintenance={data.maintenance}
              documents={data.documents}
              serviceBookings={data.serviceBookings}
              serviceCenters={data.serviceCenters}
            />
          </>
        }
      />
      <Route
        path="/compliance"
        element={
          <>
            <Topbar title="Compliance" subtitle="Priority alerts and renewal actions" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Compliance
              documents={data.documents}
              maintenance={data.maintenance}
              vehicles={data.vehicles}
              serviceBookings={data.serviceBookings}
              maintenancePredictionMap={data.maintenancePredictionMap}
            />
          </>
        }
      />
      <Route
        path="/profile"
        element={
          <>
            <Topbar title="Profile Settings" subtitle="Manage your account" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <ProfileSettings
              email={email}
              role={userRole}
              name={fullName}
              phone={phone}
              profileLoading={profileLoading}
              loading={loading}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={handleChangePassword}
            />
          </>
        }
      />
    </Routes>
  );
}

function ServiceRoutes() {
  const {
    handleSignOut,
    loading,
    email,
    role,
    fullName,
    phone,
    handleUpdateProfile,
    handleChangePassword,
    profileLoading,
    token,
  } = useAuth();

  const resolvedName = fullName || (email ? email.split("@")[0] : "Service Center");
  const userName = resolvedName.split(" ")[0];
  const userRole = role || "service";

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/service" replace />} />
      <Route
        path="/service"
        element={
          <>
            <Topbar
              title="Service Center Dashboard"
              subtitle="Booking queue and workshop workload"
              userName={userName}
              userRole={userRole}
              onSignOut={handleSignOut}
            />
            <ServicePortal token={token} />
          </>
        }
      />
      <Route
        path="/service/bookings"
        element={
          <>
            <Topbar
              title="Service Bookings"
              subtitle="Accept, complete, and update service jobs"
              userName={userName}
              userRole={userRole}
              onSignOut={handleSignOut}
            />
            <ServicePortal token={token} initialTab="bookings" />
          </>
        }
      />
      <Route
        path="/profile"
        element={
          <>
            <Topbar title="Profile Settings" subtitle="Manage your account" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <ProfileSettings
              email={email}
              role={userRole}
              name={fullName}
              phone={phone}
              profileLoading={profileLoading}
              loading={loading}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={handleChangePassword}
            />
          </>
        }
      />
      <Route path="*" element={<Navigate to="/service" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { accessToken, role, profileLoading, error, setError, authReady } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  function appHomePath() {
    if (role === "driver") return "/driver";
    if (role === "service") return "/service";
    return "/dashboard";
  }

  if (!authReady) {
    return <LoadingScreen />;
  }

  if (path === "/") {
    return <PublicHomePage accessToken={accessToken} role={role} />;
  }

  if (path === "/login") {
    if (accessToken) return <Navigate to={appHomePath()} replace />;
    return <AuthPortal />;
  }

  if (path === "/login/manager" || path === "/login/driver" || path === "/login/service") {
    if (accessToken) return <Navigate to={appHomePath()} replace />;
    return <Navigate to="/login" replace />;
  }

  if (path === "/signup") {
    if (accessToken) return <Navigate to={appHomePath()} replace />;
    return <AuthPortal initialSignup />;
  }

  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading && !role) {
    return <LoadingScreen />;
  }

  return (
    <AppLayout showSidebar={role !== "driver"} role={role}>
      {error && (
        <div className="alert alert--error">
          <span>{error}</span>
          <button className="alert__close" type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
      {role === "driver" ? <DriverRoutes /> : role === "service" ? <ServiceRoutes /> : <ManagerRoutes />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
