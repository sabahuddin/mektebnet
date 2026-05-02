import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "muallim" | "ucenik" | "roditelj";
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "mekteb_token";
const USER_KEY = "mekteb_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {}
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>(
      "POST",
      "/auth/login",
      { username, password },
    );
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    // Best-effort: tražimo backend da obriše HttpOnly H5P session cookie tako
    // da browser nakon logout-a više ne može pristupiti H5P static fajlovima.
    // Greška se ignorira (offline, network) — lokalni state se svakako briše.
    apiRequest("POST", "/auth/logout").catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    // Signaliziraj PWA sloju da obriše Workbox/Cache Storage cache-eve da
    // sljedeći korisnik na shared device-u ne vidi stale podatke.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mekteb:logout"));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
