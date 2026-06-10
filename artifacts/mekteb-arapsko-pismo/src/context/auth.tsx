import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/api";
import { loginPushUser, logoutPushUser } from "@/lib/push";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "muallim" | "ucenik" | "roditelj";
  email?: string;
  /** Da li je admin odobrio pretplatu. Kada je true, baner probnog perioda nestaje. */
  isActive?: boolean;
  /** ISO datum do kojeg traje 7-dnevni probni period (null nakon aktivacije). */
  trialUntil?: string | null;
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
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);
        // Restore push alias za već-prijavljenog korisnika (npr. nakon refresh-a)
        loginPushUser(parsedUser.id).catch(() => {});
        // Osvježi status sa servera (isActive/trialUntil/uloga) — npr. admin je
        // u međuvremenu odobrio pretplatu, pa baner probnog perioda treba
        // nestati bez ponovne prijave. Mrežnu/auth grešku tiho ignorišemo.
        apiRequest<AuthUser>("GET", "/auth/me", undefined, storedToken)
          .then((fresh) => {
            const merged = { ...parsedUser, ...fresh };
            setUser(merged);
            localStorage.setItem(USER_KEY, JSON.stringify(merged));
          })
          .catch((err) => {
            // Token istekao/nevažeći ili probni period istekao (401/403) →
            // očisti lokalni auth state da UI ne tvrdi da smo prijavljeni dok
            // API odbija. Mrežne/privremene greške tiho ignorišemo.
            const status = (err as { status?: number })?.status;
            if (status === 401 || status === 403) {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              setToken(null);
              setUser(null);
            }
          });
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
    // Poveži OneSignal subscription sa našim user ID-jem; ako je permission
    // već dat, registruje token automatski. Greška ne smije blokirati login.
    loginPushUser(res.user.id).catch(() => {});
  };

  const logout = () => {
    // Best-effort: tražimo backend da obriše HttpOnly H5P session cookie tako
    // da browser nakon logout-a više ne može pristupiti H5P static fajlovima.
    // Greška se ignorira (offline, network) — lokalni state se svakako briše.
    apiRequest("POST", "/auth/logout").catch(() => {});
    // Skini OneSignal alias + obriši push token iz backend-a (best-effort)
    logoutPushUser().catch(() => {});
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
