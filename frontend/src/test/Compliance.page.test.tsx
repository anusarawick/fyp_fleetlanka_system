import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Compliance from "../pages/Compliance";

function dateInDays(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderCompliance(overrides: Partial<Parameters<typeof Compliance>[0]> = {}) {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Compliance
        vehicles={[{ id: "vehicle-1", plate_no: "MLV3-001", odometer_km: 49000, next_service_due_km: 50000 }]}
        documents={[{ id: "doc-1", vehicle_id: "vehicle-1", doc_type: "Revenue License", expiry_date: dateInDays(3) }]}
        maintenance={[]}
        serviceBookings={[{ id: "booking-1", vehicle_id: "vehicle-1", requested_date: dateInDays(2), status: "completed", completion_review_status: "pending" }]}
        maintenancePredictionMap={{}}
        {...overrides}
      />
    </MemoryRouter>
  );
}

describe("Compliance page actions", () => {
  it("opens issue breakdown and filters the register by category action", async () => {
    renderCompliance();

    await userEvent.click(screen.getByRole("button", { name: "View all" }));
    const dialog = screen.getByRole("dialog", { name: "Issue breakdown report" });

    expect(within(dialog).getByText("Total Tracked Issues")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /View Documents/i }));

    expect(screen.queryByRole("dialog", { name: "Issue breakdown report" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Documents/i })).toHaveClass("is-active");
    expect(screen.getByText("Revenue License Expiring Soon")).toBeInTheDocument();
  });

  it("opens next seven days calendar and can apply the register range", async () => {
    renderCompliance();

    await userEvent.click(screen.getByRole("button", { name: "View calendar" }));
    const dialog = screen.getByRole("dialog", { name: "Next seven days compliance calendar" });

    expect(within(dialog).getByText("Next 7 Days Calendar")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "View in Register" }));

    expect(screen.queryByRole("dialog", { name: "Next seven days compliance calendar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Range")).toHaveValue("next7");
  });

  it("shows a clean empty state when no issues exist", () => {
    renderCompliance({ vehicles: [], documents: [], serviceBookings: [], maintenancePredictionMap: {} });

    expect(screen.getByText("No compliance issues match the current filters.")).toBeInTheDocument();
    expect(screen.getByText("No dated compliance work in the next 7 days.")).toBeInTheDocument();
  });
});
