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
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import ChatPanel, { AiAssistant, ChatRequest } from "./components/ChatPanel";
import { FeedbackProvider, useFeedback } from "./context/FeedbackContext";
import { NotificationProvider } from "./context/NotificationContext";
import { supabase } from "./services/supabase";
import PasswordStrengthGuide from "./components/PasswordStrengthGuide";
import { validateEmail, validatePassword } from "./utils/passwordPolicy";

const BRAND_LOGO_SRC = "/icons/fleetlanka-logo.png";

type AuthErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword" | "resetEmail", string>>;

function AuthFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="auth-field-error">{message}</span>;
}

// ===== UNIFIED LOGIN / MANAGER SIGNUP =====
function AuthPortal({ initialSignup = false }: { initialSignup?: boolean }) {
  const { email, password, setEmail, setPassword, handleLogin, handleSignup, loading } = useAuth();
  const feedback = useFeedback();
  const [isSignup, setIsSignup] = useState(initialSignup);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const title = isSignup ? "Create Manager Account" : "Sign in to FleetLanka";
  const subtitle = isSignup
    ? "Create a manager workspace for your fleet operations."
    : "Enter your credentials to open your workspace.";

  function resetMode(nextSignup: boolean) {
    setIsSignup(nextSignup);
    setErrors({});
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function validateAuthForm() {
    const nextErrors: AuthErrors = {};
    if (isSignup && !name.trim()) nextErrors.name = "Full name is required.";
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    const passwordError = validatePassword(password, {
      requireStrong: isSignup,
      context: { email, fullName: name, orgName },
    });
    if (passwordError) nextErrors.password = passwordError;
    if (isSignup) {
      if (!confirmPassword) {
        nextErrors.confirmPassword = "Confirm your password.";
      } else if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAuthForm()) return;
    if (isSignup) {
      await handleSignup(e, name, orgName);
    } else {
      await handleLogin(e);
    }
  }

  function openForgotPassword() {
    setResetEmail(email);
    setErrors({});
    setResetSent(false);
    setForgotOpen(true);
  }

  async function submitForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(resetEmail);
    if (emailError) {
      setErrors((current) => ({ ...current, resetEmail: emailError }));
      return;
    }
    setErrors((current) => ({ ...current, resetEmail: undefined }));
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      feedback.success("Reset email sent", "Check your email for the password reset link.");
    } catch (err: any) {
      feedback.error("Reset email failed", err.message || "Could not send the reset email.");
    } finally {
      setResetSending(false);
    }
  }

  return (
    <section className="auth auth--portal">
      <div className="auth__shell auth__shell--single">
        <Link className="auth__back" to="/">
          <ArrowLeft aria-hidden="true" />
          Back to home
        </Link>

        <div className="auth__card">
          <div className="auth__header">
            <span className="auth__icon" aria-hidden="true">
              <img src={BRAND_LOGO_SRC} alt="" />
            </span>
            <h2>{title}</h2>
            <p className="muted">{subtitle}</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            {isSignup && (
              <label>
                Full Name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
                  }}
                  aria-invalid={Boolean(errors.name)}
                  required
                />
                <AuthFieldError message={errors.name} />
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
                }}
                aria-invalid={Boolean(errors.email)}
                required
              />
              <AuthFieldError message={errors.email} />
            </label>
            <label>
              Password
              <span className="auth-password-control">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignup ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  required
                  minLength={isSignup ? 10 : undefined}
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </span>
              <AuthFieldError message={errors.password} />
              {isSignup && <PasswordStrengthGuide password={password} context={{ email, fullName: name, orgName }} />}
            </label>

            {isSignup && (
              <label>
                Confirm Password
                <span className="auth-password-control">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }));
                    }}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  required
                  minLength={10}
                />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                    {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
                <AuthFieldError message={errors.confirmPassword} />
              </label>
            )}

            {!isSignup && (
              <button className="auth__forgot" type="button" onClick={openForgotPassword}>
                Forgot password?
              </button>
            )}

            <button className="btn" type="submit" disabled={loading}>
              {loading
                ? (isSignup ? "Creating account..." : "Signing in...")
                : (isSignup ? "Create manager account" : "Sign in")}
            </button>
          </form>

          {isSignup && (
            <div className="auth__note">
              <CheckCircle2 aria-hidden="true" />
              You can add vehicles, drivers, and service centers after registration.
            </div>
          )}

          <div className="auth__toggle">
            {isSignup ? (
              <p>
                Already have an account?{" "}
                <button type="button" onClick={() => resetMode(false)}>
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Need a manager workspace?{" "}
                <button type="button" onClick={() => resetMode(true)}>
                  Create manager account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {forgotOpen && (
        <div className="auth-modal-backdrop" role="presentation">
          <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Reset password">
            <div className="auth-modal__header">
              <div>
                <h3>Reset your password</h3>
                <p>Enter your account email and we will send a reset link.</p>
              </div>
              <button type="button" onClick={() => setForgotOpen(false)} aria-label="Close reset password dialog">×</button>
            </div>
            {resetSent ? (
              <div className="auth-modal__success">
                <Mail aria-hidden="true" />
                <strong>Check your email</strong>
                <p>We sent a password reset link to {resetEmail.trim()}.</p>
                <button className="btn" type="button" onClick={() => setForgotOpen(false)}>Done</button>
              </div>
            ) : (
              <form className="auth-form" onSubmit={submitForgotPassword} noValidate>
                <label>
                  Email Address
                  <input
                    type="email"
                    placeholder="user@company.com"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      if (errors.resetEmail) setErrors((current) => ({ ...current, resetEmail: undefined }));
                    }}
                    aria-invalid={Boolean(errors.resetEmail)}
                  />
                  <AuthFieldError message={errors.resetEmail} />
                </label>
                <button className="btn" type="submit" disabled={resetSending}>
                  {resetSending ? "Sending reset link..." : "Send reset link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ResetPasswordPage() {
  const feedback = useFeedback();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  function validateResetForm() {
    const nextErrors: AuthErrors = {};
    const passwordError = validatePassword(newPassword, { requireStrong: true });
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your new password.";
    } else if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!validateResetForm()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      setComplete(true);
      feedback.success("Password updated", "You can now sign in with your new password.");
    } catch (err: any) {
      feedback.error("Password reset failed", err.message || "Open the reset link from your email and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth auth--portal">
      <div className="auth__shell auth__shell--single">
        <Link className="auth__back" to="/">
          <ArrowLeft aria-hidden="true" />
          Back to home
        </Link>
        <div className="auth__card">
          <div className="auth__header">
            <span className="auth__icon" aria-hidden="true">
              <img src={BRAND_LOGO_SRC} alt="" />
            </span>
            <h2>{complete ? "Password updated" : "Create a new password"}</h2>
            <p className="muted">
              {complete ? "Your password has been changed successfully." : "Enter a new password for your FleetLanka account."}
            </p>
          </div>
          {complete ? (
            <Link className="btn" to="/login">Back to sign in</Link>
          ) : (
            <form className="auth-form" onSubmit={submitReset} noValidate>
              <label>
                New Password
                <span className="auth-password-control">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    aria-invalid={Boolean(errors.password)}
                    minLength={10}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
                <AuthFieldError message={errors.password} />
                <PasswordStrengthGuide password={newPassword} />
              </label>
              <label>
                Confirm Password
                <span className="auth-password-control">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }));
                    }}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    minLength={10}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                    {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
                <AuthFieldError message={errors.confirmPassword} />
              </label>
              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Updating password..." : "Update password"}
              </button>
            </form>
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
  const { handleSignOut, loading, email, role, fullName, phone, orgName, handleUpdateProfile, handleChangePassword, profileLoading, token } = useAuth();
  const data = useData();
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);

  // Extract user name from email (before @)
  const resolvedName = fullName || (email ? email.split("@")[0] : "Manager");
  const userName = resolvedName.split(" ")[0];
  const userRole = role || "manager";

  return (
    <>
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
              fuelCostTotal={data.currency.format(data.fuelCostThisMonth)}
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
              centerPaymentAccess={data.centerPaymentAccess}
              setCenterPaymentAccess={data.setCenterPaymentAccess}
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
              onCreateBookingCheckout={data.handleCreateBookingCheckout}
              onOpenCenterChat={(centerId) => setChatRequest({ nonce: Date.now(), kind: "service_center", id: centerId })}
              onOpenBookingChat={(bookingId) => setChatRequest({ nonce: Date.now(), kind: "booking", id: bookingId })}
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
              onGetDocumentFileUrl={data.getDocumentFileUrl}
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
            <Topbar title="Profile Settings" subtitle="Manage your account and security preferences." userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <ProfileSettings
              email={email}
              role={userRole}
              organizationName={orgName}
              name={fullName}
              phone={phone}
              profileLoading={profileLoading}
              loading={loading}
              token={token}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={handleChangePassword}
            />
          </>
        }
      />
    </Routes>
    <ChatPanel token={token} role="manager" request={chatRequest} onRequestHandled={() => setChatRequest(null)} />
    <AiAssistant token={token} />
    </>
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
    orgName,
    handleUpdateProfile,
    handleChangePassword,
    profileLoading,
    token,
  } = useAuth();

  const resolvedName = fullName || (email ? email.split("@")[0] : "Service Center");
  const userName = resolvedName.split(" ")[0];
  const userRole = role || "service";
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);

  return (
    <>
    <Routes>
      <Route path="/" element={<Navigate to="/service" replace />} />
      <Route
        path="/service"
        element={
          <>
            <Topbar
              title="Service Dashboard"
              subtitle="Today's workshop queue and booking status."
              userName={userName}
              userRole={userRole}
              onSignOut={handleSignOut}
            />
            <ServicePortal token={token} onOpenBookingChat={(bookingId) => setChatRequest({ nonce: Date.now(), kind: "booking", id: bookingId })} />
          </>
        }
      />
      <Route
        path="/service/bookings"
        element={
          <>
            <Topbar
              title="Service Bookings"
              subtitle="Confirm bookings, complete jobs, and track manager approval."
              userName={userName}
              userRole={userRole}
              onSignOut={handleSignOut}
            />
            <ServicePortal token={token} initialTab="bookings" onOpenBookingChat={(bookingId) => setChatRequest({ nonce: Date.now(), kind: "booking", id: bookingId })} />
          </>
        }
      />
      <Route
        path="/profile"
        element={
          <>
            <Topbar title="Profile Settings" subtitle="Manage your account and security preferences." userName={userName} userRole={userRole} onSignOut={handleSignOut} />
            <ProfileSettings
              email={email}
              role={userRole}
              organizationName={orgName}
              name={fullName}
              phone={phone}
              profileLoading={profileLoading}
              loading={loading}
              token={token}
              onUpdateProfile={handleUpdateProfile}
              onChangePassword={handleChangePassword}
            />
          </>
        }
      />
      <Route path="*" element={<Navigate to="/service" replace />} />
    </Routes>
    <ChatPanel token={token} role="service" request={chatRequest} onRequestHandled={() => setChatRequest(null)} />
    </>
  );
}

function AppContent() {
  const { accessToken, role, profileLoading, authReady, passwordChangeRequiresLogin, clearPasswordChangeRedirect } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    if (path === "/login" && !accessToken && passwordChangeRequiresLogin) {
      clearPasswordChangeRedirect();
    }
  }, [accessToken, clearPasswordChangeRedirect, passwordChangeRequiresLogin, path]);

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

  if (path === "/reset-password") {
    return <ResetPasswordPage />;
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

  if (!accessToken && passwordChangeRequiresLogin) {
    return <Navigate to="/login" replace />;
  }

  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading && !role) {
    return <LoadingScreen />;
  }

  return (
    <AppLayout showSidebar={role !== "driver"} role={role}>
      {role === "driver" ? <DriverRoutes /> : role === "service" ? <ServiceRoutes /> : <ManagerRoutes />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <FeedbackProvider>
        <AuthProvider>
          <NotificationProvider>
            <DataProvider>
              <AppContent />
            </DataProvider>
          </NotificationProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
