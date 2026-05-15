import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfileSettings from "../pages/ProfileSettings";
import { apiGet, apiPatch } from "../services/api";

const mocks = vi.hoisted(() => ({
  feedback: {
    success: vi.fn(),
    error: vi.fn(),
  },
  refreshNotifications: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  isAuthSessionExpiredError: vi.fn(() => false),
}));

vi.mock("../context/FeedbackContext", () => ({
  useFeedback: () => mocks.feedback,
}));

vi.mock("../context/NotificationContext", () => ({
  useNotifications: () => ({ refreshNotifications: mocks.refreshNotifications }),
}));

function renderProfile(overrides: Partial<Parameters<typeof ProfileSettings>[0]> = {}) {
  return render(
    <ProfileSettings
      email="manager@example.com"
      role="manager"
      organizationName="Demo Org"
      name="Fleet Manager"
      phone="123456789"
      token="token-1"
      onUpdateProfile={vi.fn().mockResolvedValue(undefined)}
      onChangePassword={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />
  );
}

describe("ProfileSettings page", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockResolvedValue({
      documents: true,
      maintenance: true,
      approvals: true,
      ml: true,
      bookings: true,
      payments: true,
      chat: true,
      trips: true,
      fuel: true,
    });
    vi.mocked(apiPatch).mockResolvedValue({
      documents: false,
      maintenance: false,
      approvals: false,
      ml: false,
      bookings: false,
      payments: false,
      chat: false,
      trips: false,
      fuel: false,
    });
    mocks.feedback.success.mockReset();
    mocks.feedback.error.mockReset();
    mocks.refreshNotifications.mockReset().mockResolvedValue(undefined);
  });

  it("opens password modal and submits through the existing handler", async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    renderProfile({ onChangePassword });

    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    const dialog = screen.getByRole("dialog", { name: "Change password" });

    fireEvent.change(within(dialog).getByPlaceholderText("Enter current password"), { target: { value: "OldPass1!" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter new password"), { target: { value: "RoadOps#2026" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Confirm new password"), { target: { value: "RoadOps#2026" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Update Password" }));

    expect(onChangePassword).toHaveBeenCalledWith("OldPass1!", "RoadOps#2026");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Change password" })).not.toBeInTheDocument());
  });

  it("blocks weak or mismatched profile password changes", async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    renderProfile({ onChangePassword });

    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    const dialog = screen.getByRole("dialog", { name: "Change password" });

    fireEvent.change(within(dialog).getByPlaceholderText("Enter current password"), { target: { value: "OldPass1!" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter new password"), { target: { value: "weak" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Confirm new password"), { target: { value: "different" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Update Password" }));

    expect(onChangePassword).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(within(dialog).getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("keeps the password modal open and marks current password when the server rejects it", async () => {
    const onChangePassword = vi.fn().mockRejectedValue(new Error("Current password is incorrect"));
    renderProfile({ onChangePassword });

    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    const dialog = screen.getByRole("dialog", { name: "Change password" });

    fireEvent.change(within(dialog).getByPlaceholderText("Enter current password"), { target: { value: "WrongPass1!" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Enter new password"), { target: { value: "RoadOps#2026" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Confirm new password"), { target: { value: "RoadOps#2026" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Update Password" }));

    expect(onChangePassword).toHaveBeenCalledWith("WrongPass1!", "RoadOps#2026");
    expect(screen.getByRole("dialog", { name: "Change password" })).toBeInTheDocument();
    expect(within(dialog).getByText("Current password is incorrect.")).toBeInTheDocument();
  });

  it("opens notification preferences, disables all visible categories, saves, and refreshes notifications", async () => {
    renderProfile();

    await userEvent.click(screen.getByRole("button", { name: "Change Preferences" }));
    const dialog = screen.getByRole("dialog", { name: "Notification preferences" });

    expect(within(dialog).getByText("Critical & Account")).toBeInTheDocument();
    expect(within(dialog).getByText("Required")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Disable All" }));
    const checkboxes = within(dialog).getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);

    await userEvent.click(within(dialog).getByRole("button", { name: "Save Preferences" }));

    expect(apiPatch).toHaveBeenCalledWith(
      "/notifications/preferences",
      expect.objectContaining({ documents: false, maintenance: false, approvals: false }),
      "token-1"
    );
    await waitFor(() => expect(mocks.refreshNotifications).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notification preferences" })).not.toBeInTheDocument());
  });
});
