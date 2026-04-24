import { SessionUser } from "./role";

const STORAGE_KEY = "geotagging.session";

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearSessionUser() {
  localStorage.removeItem(STORAGE_KEY);
}