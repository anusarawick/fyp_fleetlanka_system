export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: string;
  detail: unknown;

  constructor(status: number, body: string) {
    super(formatApiErrorMessage(body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.detail = parseApiDetail(body);
  }
}

export function isAuthSessionExpiredError(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return false;
  const message = `${error.message} ${error.body}`.toLowerCase();
  return message.includes("session_id") || message.includes("invalid token") || message.includes("jwt");
}

function parseApiDetail(body: string) {
  try {
    return JSON.parse(body)?.detail;
  } catch {
    return undefined;
  }
}

function formatApiErrorMessage(body: string) {
  const detail = parseApiDetail(body);
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail?.password_errors) && detail.password_errors.length > 0) {
    return detail.password_errors[0];
  }
  return body;
}

async function readOrThrow(res: Response) {
  if (res.ok) return;
  const body = await res.text();
  const error = new ApiError(res.status, body);
  if (isAuthSessionExpiredError(error) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fleetlanka:auth-session-expired"));
  }
  throw error;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  await readOrThrow(res);
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  await readOrThrow(res);
  return res.json();
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  await readOrThrow(res);
  return res.json();
}

export async function apiPostForm<T>(
  path: string,
  body: FormData,
  token?: string
): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  await readOrThrow(res);
  return res.json();
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  await readOrThrow(res);
  return res.json();
}
