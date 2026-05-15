export function formatBookingReference(id?: string | null) {
  const normalized = String(id || "").trim();
  if (!normalized) return "--";
  const compact = normalized.includes("-") ? normalized.split("-")[0] : normalized.replace(/-/g, "").slice(0, 8);
  const firstPart = compact || normalized.slice(0, 8);
  return `BK-${firstPart.toUpperCase()}`;
}
