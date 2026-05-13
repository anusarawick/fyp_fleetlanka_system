import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Driver from "../pages/Driver";

vi.mock("../components/NotificationBell", () => ({
  default: () => <button type="button">Notifications</button>,
}));

vi.mock("../components/TripRoutePreview", () => ({
  default: () => <div data-testid="route-preview">Route preview</div>,
}));

vi.mock("../services/api", () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    token: "token-1",
    fullName: "Driver One",
    phone: "0770000000",
    email: "driver@example.com",
    role: "driver",
    loading: false,
    handleUpdateProfile: vi.fn(),
    handleChangePassword: vi.fn(),
  }),
}));

vi.mock("../context/FeedbackContext", () => ({
  useFeedback: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

const defaultProps = {
  vehicles: [{ id: "vehicle-1", plate_no: "MLV3-001" }],
  trips: [
    {
      id: "trip-assigned",
      vehicle_id: "vehicle-1",
      status: "assigned",
      trip_title: "Airport pickup",
      scheduled_start: new Date().toISOString(),
      origin_label: "Colombo",
      destination_label: "Katunayake",
      origin_lat: 6.9271,
      origin_lon: 79.8612,
      destination_lat: 7.1808,
      destination_lon: 79.8841,
      contact_name: "Dispatcher",
      contact_phone: "011222333",
      priority: "high",
      notes: "Call on arrival",
    },
    {
      id: "trip-completed",
      vehicle_id: "vehicle-1",
      status: "completed",
      trip_title: "Completed delivery",
      scheduled_start: new Date(Date.now() - 86_400_000).toISOString(),
      start_time: new Date(Date.now() - 86_000_000).toISOString(),
      end_time: new Date(Date.now() - 82_000_000).toISOString(),
      origin_label: "Kandy",
      destination_label: "Colombo",
      distance_km: 116.4,
      duration_min: 180,
      avg_speed_kmh: 38.8,
      idle_min: 12,
    },
  ],
  loading: false,
  activeTripId: null,
  tripTrackingStatus: "inactive" as const,
  tripTrackingLastUpdated: null,
  pendingTripSyncCount: 0,
  pendingGpsPointCount: 0,
  syncingTripQueue: false,
  pendingTripStatusById: {},
  driverScore: 84,
  driverScoreLabel: "Good" as const,
  driverScoreBreakdown: { speed: 85, idle: 80, distance: 90, consistency: 82 },
  startTrip: vi.fn(),
  stopTrip: vi.fn(),
  onSignOut: vi.fn(),
};

function renderDriver(props: Partial<typeof defaultProps> = {}) {
  return render(<Driver {...defaultProps} {...props} />);
}

describe("Driver PWA trip views", () => {
  beforeEach(() => {
    window.localStorage.clear();
    defaultProps.startTrip.mockReset();
    defaultProps.stopTrip.mockReset();
  });

  it("opens assigned trip details and shows start action from the trip tab", async () => {
    renderDriver();

    await userEvent.click(screen.getByRole("button", { name: "Trips" }));
    await userEvent.click(screen.getByRole("button", { name: "View assigned trip details" }));

    const dialog = screen.getByRole("dialog", { name: "Assigned trip details" });
    expect(within(dialog).getByText("Airport pickup")).toBeInTheDocument();
    expect(within(dialog).getByText("Route")).toBeInTheDocument();
    expect(within(dialog).getByTestId("route-preview")).toBeInTheDocument();
  });

  it("opens trip history details from the history tab", async () => {
    renderDriver();

    await userEvent.click(screen.getByRole("button", { name: "Trips" }));
    await userEvent.click(screen.getByRole("button", { name: "History" }));
    await userEvent.click(screen.getByRole("button", { name: /Completed delivery/i }));

    const dialog = screen.getByRole("dialog", { name: "Trip history details" });
    expect(within(dialog).getByText("Performance")).toBeInTheDocument();
    expect(within(dialog).getByText("116.4 km")).toBeInTheDocument();
  });

  it("shows assigned and history empty states", async () => {
    renderDriver({ trips: [] });

    await userEvent.click(screen.getByRole("button", { name: "Trips" }));
    expect(screen.getByText("No assigned trips available.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("No trip history available.")).toBeInTheDocument();
  });
});
