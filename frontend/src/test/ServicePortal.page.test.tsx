import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ServicePortal from "../pages/ServicePortal";
import { apiGet } from "../services/api";

const mocks = vi.hoisted(() => ({
  feedback: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../services/api", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock("../context/FeedbackContext", () => ({
  useFeedback: () => mocks.feedback,
}));

function dateInDays(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderPortal() {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ServicePortal token="token-1" initialTab="bookings" />
    </MemoryRouter>
  );
}

describe("ServicePortal booking filters", () => {
  beforeEach(() => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce({
        center: { id: "center-1", name: "Colombo Auto Care" },
        summary: { pending_count: 1, confirmed_count: 1, completed_today_count: 0, total_completed_count: 1 },
      })
      .mockResolvedValueOnce([
        {
          id: "recent-booking",
          vehicle_id: "vehicle-1",
          requested_date: dateInDays(-2),
          status: "pending",
          work_type: "Regular Service",
          vehicle_plate_no: "MLV3-001",
        },
        {
          id: "older-booking",
          vehicle_id: "vehicle-2",
          requested_date: dateInDays(-20),
          status: "confirmed",
          work_type: "Brake Service",
          vehicle_plate_no: "MLV3-020",
        },
      ]);
    mocks.feedback.error.mockReset();
  });

  it("defaults to last 7 days and expands to last 30 days", async () => {
    renderPortal();

    expect(await screen.findByText("MLV3-001")).toBeInTheDocument();
    expect(screen.queryByText("MLV3-020")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Date Range"), "last30");

    expect(await screen.findByText("MLV3-020")).toBeInTheDocument();
  });

  it("shows custom date fields without breaking the filter controls", async () => {
    renderPortal();
    await screen.findByText("MLV3-001");

    await userEvent.selectOptions(screen.getByLabelText("Date Range"), "custom");

    expect(screen.getByLabelText("Custom range start date")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom range end date")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Work Type")).toBeInTheDocument();
  });
});
