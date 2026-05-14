import { describe, expect, it } from "vitest";

import { formatBookingReference } from "../utils/bookings";

describe("formatBookingReference", () => {
  it("formats booking references from uuid first segment", () => {
    expect(formatBookingReference("fd26db49-1234-4567-89ab-abcdef123456")).toBe("BK-FD26DB49");
  });

  it("uses the first eight characters when an id has no uuid separator", () => {
    expect(formatBookingReference("abcdef123456")).toBe("BK-ABCDEF12");
  });

  it("falls back when id is missing", () => {
    expect(formatBookingReference(undefined)).toBe("--");
  });
});
