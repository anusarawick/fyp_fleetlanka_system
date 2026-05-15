import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NotificationBell from "../components/NotificationBell";
import type { NotificationItem } from "../context/NotificationContext";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refresh: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  dismiss: vi.fn(),
  state: {
    notifications: [] as NotificationItem[],
    unreadCount: 0,
    loading: false,
    hasLoaded: true,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../context/NotificationContext", () => ({
  useNotifications: () => ({
    ...mocks.state,
    refreshNotifications: mocks.refresh,
    markNotificationRead: mocks.markRead,
    markAllNotificationsRead: mocks.markAllRead,
    dismissNotification: mocks.dismiss,
  }),
}));

function renderBell() {
  return render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mocks.state.notifications = [
      {
        id: "alert-1",
        alert_type: "ml_high_risk",
        title: "High maintenance risk",
        message: "MLV3-015 has a high risk score.",
        severity: "danger",
        category: "ml",
        action_url: "/ml-predictions",
        read_at: null,
        created_at: "2026-05-13T09:00:00+00:00",
      },
    ];
    mocks.state.unreadCount = 1;
    mocks.state.loading = false;
    mocks.state.hasLoaded = true;
    mocks.navigate.mockReset();
    mocks.refresh.mockReset().mockResolvedValue(undefined);
    mocks.markRead.mockReset().mockResolvedValue(undefined);
    mocks.markAllRead.mockReset().mockResolvedValue(undefined);
    mocks.dismiss.mockReset().mockResolvedValue(undefined);
  });

  it("shows unread count and refreshes when opened", async () => {
    renderBell();

    await userEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText("High maintenance risk")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("marks a notification read and navigates to its action link", async () => {
    renderBell();
    await userEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));
    await userEvent.click(screen.getByRole("button", { name: /High maintenance risk/i }));

    expect(mocks.markRead).toHaveBeenCalledWith("alert-1");
    expect(mocks.navigate).toHaveBeenCalledWith("/ml-predictions");
  });

  it("dismisses a notification without opening its action link", async () => {
    renderBell();
    await userEvent.click(screen.getByRole("button", { name: "1 unread notifications" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(mocks.dismiss).toHaveBeenCalledWith("alert-1");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows an empty state and disables mark-read when nothing is unread", async () => {
    mocks.state.notifications = [];
    mocks.state.unreadCount = 0;

    renderBell();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("No notifications right now.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Mark read/i })).toBeDisabled());
  });
});
