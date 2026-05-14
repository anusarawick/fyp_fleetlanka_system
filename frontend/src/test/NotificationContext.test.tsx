import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationProvider, useNotifications } from "../context/NotificationContext";
import { apiGet, apiPost } from "../services/api";

const mocks = vi.hoisted(() => ({
  feedback: {
    error: vi.fn(),
  },
}));

vi.mock("../services/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  isAuthSessionExpiredError: vi.fn(() => false),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ token: "token-1", authReady: true }),
}));

vi.mock("../context/FeedbackContext", () => ({
  useFeedback: () => mocks.feedback,
}));

function Harness() {
  const notifications = useNotifications();
  return (
    <div>
      <span data-testid="count">{notifications.unreadCount}</span>
      <span data-testid="loaded">{String(notifications.hasLoaded)}</span>
      <ul>
        {notifications.notifications.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
      <button type="button" onClick={() => notifications.markNotificationRead("alert-1")}>Read one</button>
      <button type="button" onClick={() => notifications.markAllNotificationsRead()}>Read all</button>
      <button type="button" onClick={() => notifications.dismissNotification("alert-1")}>Dismiss one</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <Harness />
    </NotificationProvider>
  );
}

describe("NotificationContext", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
    vi.mocked(apiPost).mockReset();
    mocks.feedback.error.mockReset();
  });

  it("loads notifications and derives unread count", async () => {
    vi.mocked(apiGet).mockResolvedValue([
      {
        id: "alert-1",
        alert_type: "chat",
        title: "New message",
        message: "A service center sent a message.",
        severity: "info",
        category: "chat",
        read_at: null,
        created_at: "2026-05-13T10:00:00+00:00",
      },
    ]);

    renderProvider();

    expect(await screen.findByText("New message")).toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("loaded")).toHaveTextContent("true");
  });

  it("optimistically marks read and restores on API failure", async () => {
    vi.mocked(apiGet).mockResolvedValue([
      {
        id: "alert-1",
        alert_type: "chat",
        title: "New message",
        message: "A service center sent a message.",
        severity: "info",
        category: "chat",
        read_at: null,
        created_at: "2026-05-13T10:00:00+00:00",
      },
    ]);
    vi.mocked(apiPost).mockRejectedValueOnce(new Error("network failed"));

    renderProvider();
    await screen.findByText("New message");
    await userEvent.click(screen.getByRole("button", { name: "Read one" }));

    await waitFor(() => expect(mocks.feedback.error).toHaveBeenCalledWith("Notification update failed", "network failed"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("dismisses notification optimistically when API succeeds", async () => {
    vi.mocked(apiGet).mockResolvedValue([
      {
        id: "alert-1",
        alert_type: "payment_paid",
        title: "Payment completed",
        message: "A service payment was completed.",
        severity: "success",
        category: "payments",
        read_at: null,
        created_at: "2026-05-13T10:00:00+00:00",
      },
    ]);
    vi.mocked(apiPost).mockResolvedValueOnce({});

    renderProvider();
    await screen.findByText("Payment completed");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Dismiss one" }));
    });

    expect(screen.queryByText("Payment completed")).not.toBeInTheDocument();
  });
});
