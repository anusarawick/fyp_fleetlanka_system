import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import {
  exportFuel,
  exportMaintenance,
  exportVehicles,
  exportDrivers,
  exportTrips,
  exportDocuments,
} from "./utils/export";
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
import { useState } from "react";

// ===== ROLE SELECTION PAGE =====
function RoleSelection({ onSelectRole }: { onSelectRole: (role: "manager" | "driver" | "service") => void }) {
  return (
    <section className="auth auth--role-select">
      <div className="role-select">
        <div className="role-select__header">
          <span className="role-select__logo">🚐</span>
          <h1>FleetLanka</h1>
          <p className="muted">Choose how you want to sign in</p>
        </div>

        <div className="role-select__options">
          <button
            className="role-card role-card--manager"
            onClick={() => onSelectRole("manager")}
          >
            <div className="role-card__icon">💼</div>
            <div className="role-card__content">
              <h3>Fleet Manager</h3>
              <p>Access dashboard, analytics, and fleet management tools</p>
            </div>
            <span className="role-card__badge">Web Portal</span>
          </button>

          <button
            className="role-card role-card--driver"
            onClick={() => onSelectRole("driver")}
          >
            <div className="role-card__icon">🚗</div>
            <div className="role-card__content">
              <h3>Driver</h3>
              <p>Start trips, track location, and log activities</p>
            </div>
            <span className="role-card__badge">Mobile App</span>
          </button>

          <button
            className="role-card role-card--service"
            onClick={() => onSelectRole("service")}
          >
            <div className="role-card__icon">🏪</div>
            <div className="role-card__content">
              <h3>Service Center</h3>
              <p>Review assigned jobs, confirm bookings, and update service progress</p>
            </div>
            <span className="role-card__badge">Partner Portal</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ===== MANAGER LOGIN (Web/Desktop optimized) =====
function ManagerLogin({ onBack }: { onBack: () => void }) {
  const { email, password, setEmail, setPassword, handleLogin, handleSignup, loading, error, setError } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    if (isSignup) {
      await handleSignup(e, name, orgName);
    } else {
      await handleLogin(e, "manager");
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <button className="auth__back" onClick={onBack}>← Back</button>
        <div className="auth__header">
          <span className="auth__icon">{isSignup ? "📝" : "💼"}</span>
          <h2>{isSignup ? "Create Account" : "Manager Login"}</h2>
          <p className="muted">
            {isSignup
              ? "Register your fleet management account"
              : "Access your fleet management dashboard"}
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
              placeholder="manager@company.com"
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
              : (isSignup ? "Create Account" : "Sign in to Dashboard")}
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
              Don't have an account?{" "}
              <button type="button" onClick={() => setIsSignup(true)}>
                Create one
              </button>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ===== DRIVER LOGIN (Mobile optimized) =====
function DriverLogin({ onBack }: { onBack: () => void }) {
  const { email, password, setEmail, setPassword, handleLogin, loading, error, setError } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    await handleLogin(e, "driver");
  }

  return (
    <section className="driver-auth">
      <header className="driver-auth__header">
        <button className="driver-auth__back" onClick={onBack}>←</button>
        <span className="driver-auth__brand">FleetLanka</span>
      </header>

      <main className="driver-auth__main">
        <div className="driver-auth__icon">🚗</div>
        <h1 className="driver-auth__title">Driver Login</h1>
        <p className="driver-auth__subtitle">Sign in to start tracking your trips</p>

        {error && (
          <div className="alert alert--error">
            <span>{error}</span>
            <button className="alert__close" type="button" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <form className="driver-form" onSubmit={onSubmit}>
          <div className="driver-form__field">
            <label>Email</label>
            <input
              type="email"
              placeholder="driver@fleetlanka.lk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="driver-form__field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="driver-btn driver-btn--primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </main>
    </section>
  );
}

function ServiceLogin({ onBack }: { onBack: () => void }) {
  const { email, password, setEmail, setPassword, handleLogin, loading, error, setError } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    await handleLogin(e, "service");
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <button className="auth__back" onClick={onBack}>← Back</button>
        <div className="auth__header">
          <span className="auth__icon">🏪</span>
          <h2>Service Center Login</h2>
          <p className="muted">Access the service portal for your assigned center.</p>
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
          <label>
            Portal Email
            <input
              type="email"
              placeholder="servicecenter@partner.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to Portal"}
          </button>
        </form>
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
    selectedVehicle,
    setSelectedVehicle,
    activeTripId,
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
      selectedVehicle={selectedVehicle}
      setSelectedVehicle={setSelectedVehicle}
      activeTripId={activeTripId}
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
              onSignOut={handleSignOut}
            />
            <Dashboard
              vehicleCount={data.vehicles.length}
              activeTrips={data.activeTrips}
              maintenanceCount={data.maintenance.length}
              fuelCostTotal={data.currency.format(data.fuelCostTotal)}
              maintenance={data.maintenance}
              lastMaintenancePrediction={data.maintResult}
              lastFuelPrediction={data.fuelResult}
              alerts={data.buildAlerts()}
              upcomingDocs={data.upcomingDocs}
            />
          </>
        }
      />
      <Route
        path="/management"
        element={
          <>
            <Topbar title="Fleet Management" subtitle="Create and manage data" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
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
            <Topbar title="Drivers" subtitle="Manage driver accounts" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Drivers
              drivers={data.drivers}
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
            <Topbar title="Fuel Analytics" subtitle="Track fuel usage" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Fuel
              vehicles={data.vehicles}
              fuelLogs={data.fuelLogs}
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
              maintCost={data.maintCost}
              setMaintCost={data.setMaintCost}
              maintOdometer={data.maintOdometer}
              setMaintOdometer={data.setMaintOdometer}
              maintNextDue={data.maintNextDue}
              setMaintNextDue={data.setMaintNextDue}
              maintPredictedDate={data.maintPredictedDate}
              setMaintPredictedDate={data.setMaintPredictedDate}
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
            />
          </>
        }
      />
      <Route
        path="/documents"
        element={
          <>
            <Topbar title="Documents" subtitle="Compliance tracking" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
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
            <Topbar title="Analytics" subtitle="Trends and exports" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Analytics
              fuelLogs={data.fuelLogs}
              maintenance={data.maintenance}
              vehicleCount={data.vehicles.length}
              driverCount={data.drivers.length}
              activeTrips={data.activeTrips}
              topPerformers={data.topPerformers}
              onExportFuel={() => exportFuel(data.fuelLogs)}
              onExportMaintenance={() => exportMaintenance(data.maintenance)}
            />
          </>
        }
      />
      <Route
        path="/ml"
        element={
          <>
            <Topbar title="ML Predictions" subtitle="Run model inference" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <MLPredictions
              vehicles={data.vehicles}
              mlVehicleId={data.mlVehicleId}
              setMlVehicleId={data.setMlVehicleId}
              maintenancePredictionMap={data.maintenancePredictionMap}
              maintFeatures={data.maintFeatures}
              setMaintFeatures={data.setMaintFeatures}
              fuelFeatures={data.fuelFeatures}
              setFuelFeatures={data.setFuelFeatures}
              maintResult={data.maintResult}
              fuelResult={data.fuelResult}
              loading={loading}
              onPredictMaintenance={data.handlePredictMaintenance}
              onPredictFuel={data.handlePredictFuel}
              onRunVehicleMaintenanceCheck={data.runVehicleMaintenanceCheck}
            />
          </>
        }
      />
      <Route
        path="/reports"
        element={
          <>
            <Topbar title="Reports" subtitle="Exports and summaries" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Reports
              onExportVehicles={() => exportVehicles(data.vehicles)}
              onExportDrivers={() => exportDrivers(data.drivers)}
              onExportTrips={() => exportTrips(data.trips)}
              onExportFuel={() => exportFuel(data.fuelLogs)}
              onExportMaintenance={() => exportMaintenance(data.maintenance)}
              onExportDocuments={() => exportDocuments(data.documents)}
            />
          </>
        }
      />
      <Route
        path="/compliance"
        element={
          <>
            <Topbar title="Compliance" subtitle="Renewals and upcoming actions" userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <Compliance
              documents={data.documents}
              maintenance={data.maintenance}
              vehicles={data.vehicles}
              serviceBookings={data.serviceBookings}
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
              subtitle="Assigned service work"
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
              subtitle="Manage assigned bookings"
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
  const [selectedLoginRole, setSelectedLoginRole] = useState<"manager" | "driver" | "service" | null>(() => {
    const stored = localStorage.getItem("fleetlanka.loginRole");
    return stored === "manager" || stored === "driver" || stored === "service" ? stored : null;
  });

  function handleSelectRole(selected: "manager" | "driver" | "service") {
    localStorage.setItem("fleetlanka.loginRole", selected);
    setSelectedLoginRole(selected);
  }

  if (!authReady) {
    return <LoadingScreen />;
  }

  // If logged in, show appropriate interface
  if (accessToken) {
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

  // Not logged in - show login flow
  if (!selectedLoginRole) {
    return <RoleSelection onSelectRole={handleSelectRole} />;
  }

  if (selectedLoginRole === "manager") {
    return <ManagerLogin onBack={() => setSelectedLoginRole(null)} />;
  }

  if (selectedLoginRole === "service") {
    return <ServiceLogin onBack={() => setSelectedLoginRole(null)} />;
  }

  return <DriverLogin onBack={() => setSelectedLoginRole(null)} />;
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
