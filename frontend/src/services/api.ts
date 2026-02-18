export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
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
  if (!res.ok) {
    throw new Error(await res.text());
  }
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
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
