import { ApiEnvelope, ApiError } from "../types/envelope";
import { getSessionUser } from "../auth/token";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseError(response: Response): Promise<ApiError> {
  let detail = "Unknown error";
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) {
      detail = body.detail;
    }
  } catch {
    detail = response.statusText || detail;
  }
  return { status: response.status, detail };
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const user = getSessionUser();
  const headers = new Headers(init.headers ?? {});

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (user) {
    headers.set("Authorization", `Bearer fake-session-${user.id}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export async function apiEnvelopeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const payload = await apiRequest<ApiEnvelope<T>>(path, init);
  return payload.data;
}

export { API_BASE_URL };