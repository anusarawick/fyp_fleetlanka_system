import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatPanel from "../components/ChatPanel";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: apiMocks.get,
  apiPost: apiMocks.post,
  isAuthSessionExpiredError: vi.fn(() => false),
}));

vi.mock("../context/FeedbackContext", () => ({
  useFeedback: () => ({
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

const managerConversation = {
  id: "conversation-1",
  service_center_id: "center-1",
  conversation_type: "service_center",
  counterparty_name: "Colombo Auto Care",
  manager_name: "MPA Wickramasinghe",
  service_center_name: "Colombo Auto Care",
  last_message_text: "Vehicle is ready",
  unread_count: 1,
};

const serviceConversation = {
  ...managerConversation,
  counterparty_name: "Fleet Manager - Demo Fleet Lanka",
  organization_name: "Demo Fleet Lanka",
  unread_count: 0,
};

function renderChat(role: "manager" | "service" = "manager") {
  return render(<ChatPanel token="token-1" role={role} />);
}

function chatLauncher() {
  const button = screen.getByText("Chat").closest("button");
  if (!button) throw new Error("Chat launcher not found");
  return button;
}

describe("ChatPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("fleetlanka-assistant-drawer-open", "true");
    apiMocks.get.mockReset();
    apiMocks.post.mockReset().mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows service center names for manager conversations", async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === "/chat/conversations") return Promise.resolve([managerConversation]);
      if (path.includes("/messages")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderChat("manager");
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledWith("/chat/conversations", "token-1"));

    await userEvent.click(chatLauncher());
    await userEvent.click(screen.getByRole("button", { name: /Colombo Auto Care/i }));

    const chatWindow = screen.getByRole("region", { name: "Messages" });
    expect(within(chatWindow).getAllByText("Colombo Auto Care").length).toBeGreaterThan(0);
  });

  it("shows organization names for service-center conversations", async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === "/service-portal/chat/conversations") return Promise.resolve([serviceConversation]);
      if (path.includes("/messages")) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderChat("service");
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledWith("/service-portal/chat/conversations", "token-1"));

    await userEvent.click(chatLauncher());

    expect(screen.getByText("Fleet Manager - Demo Fleet Lanka")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Colombo Auto Care/i })).not.toBeInTheDocument();
  });

  it("refreshes unread badges while the chat drawer is collapsed", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("fleetlanka-assistant-drawer-open", "false");
    apiMocks.get
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...managerConversation, unread_count: 2 }]);

    renderChat("manager");

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMocks.get).toHaveBeenCalledWith("/chat/conversations", "token-1");
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("loads and marks the selected conversation read while open", async () => {
    apiMocks.get.mockImplementation((path: string) => {
      if (path === "/chat/conversations") return Promise.resolve([managerConversation]);
      if (path === "/chat/conversations/conversation-1/messages") {
        return Promise.resolve([
          {
            id: "message-1",
            sender_role: "service",
            sender_name: "Service User",
            message_text: "Vehicle is ready",
            created_at: "2026-05-13T09:05:00+00:00",
          },
        ]);
      }
      return Promise.resolve([]);
    });

    renderChat("manager");
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledWith("/chat/conversations", "token-1"));
    await userEvent.click(chatLauncher());
    await userEvent.click(await screen.findByRole("button", { name: /Colombo Auto Care/i }));

    await waitFor(() => expect(screen.getAllByText("Vehicle is ready").length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/chat/conversations/conversation-1/read", {}, "token-1");
    });
  });
});
