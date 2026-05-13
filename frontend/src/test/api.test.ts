import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiDelete, apiGet, apiPatch, apiPost } from "../services/api";

describe("api service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends bearer token for GET requests", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

    const result = await apiGet<{ status: string }>("/health", "token-1");

    expect(result.status).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("http://localhost:8000/health", {
      cache: "no-store",
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("serializes JSON bodies for POST and PATCH", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ created: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updated: true }), { status: 200 }));

    await apiPost("/notifications/read-all", {}, "token-1");
    await apiPatch("/notifications/preferences", { chat: false }, "token-1");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8000/notifications/read-all",
      expect.objectContaining({ method: "POST", body: "{}" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8000/notifications/preferences",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ chat: false }) })
    );
  });

  it("throws backend error text for failed requests", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    await expect(apiDelete("/vehicles/vehicle-1", "token-1")).rejects.toThrow("Unauthorized");
  });
});
