import { v4 as uuidv4 } from "uuid";

const STUDENT_ID_KEY = "mekteb_student_id";

export function getStudentId(): string {
  const authUser = getAuthUser();
  if (authUser?.id) {
    return String(authUser.id);
  }

  let id = localStorage.getItem(STUDENT_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(STUDENT_ID_KEY, id);
  }
  return id;
}

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "muallim" | "ucenik" | "admin";
  mektebId?: number;
  mektebNaziv?: string;
  muallimId?: number;
  token: string;
}

const AUTH_KEY = "mekteb_auth_user";

export function getAuthUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(STUDENT_ID_KEY);
}

export function getStudentName(): string | null {
  return getAuthUser()?.displayName || null;
}

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
