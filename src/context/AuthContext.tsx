import type * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../services/http/errors";
import { loginApi, type LoginProfile } from "../services/auth/auth.api.ts";
import {
  applySession,
  clearSessionData,
  loadSessionData,
  restoreSession,
  saveLogin,
} from "../services/bootstrap";
import { vaultDropLegacy } from "../lib/portal/vault";
import { setSession } from "../services/session";
import { clearSmartxCache } from "../hooks/useQuery";
import {
  clearPlantSettings,
  isPlantSettingsLoaded,
  loadPlantSettings,
} from "../services/settings/plantSettings.api";
export interface User extends LoginProfile {
  name: string;
  email: string;
  role: string;
}
export interface LoginResult {
  ok: boolean;
  message: string;
}
interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  updateProfile: (name: string, email: string) => LoginResult;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

const IDLE_LIMIT_MS = 20 * 60 * 1000;
const IDLE_CHECK_MS = 15 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_KEY = "smartx.lastActivity";
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
  "touchmove",
  "pointerdown",
];
const readLastActivity = (): number => {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
};
const writeLastActivity = (t: number): void => {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(t));
  } catch {
    /* storage unavailable */
  }
};
const clearLastActivity = (): void => {
  try {
    localStorage.removeItem(ACTIVITY_KEY);
  } catch {
    /* storage unavailable */
  }
};
export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    vaultDropLegacy();
    return restoreSession() as User | null;
  });
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const { profile, record } = await loginApi(email.trim(), password);
        writeLastActivity(Date.now());
        saveLogin(email.trim(), record);
        setSession(profile);
        await loadSessionData(profile);
        applySession(profile);
        // plant wise settings: /api/Login/settings -> row of this PlantId (else PlantId 0) -> excel version
        await loadPlantSettings(
          profile.plantId,
          profile.centerStationId || profile.stationId || profile.vlccIds?.[0],
        );
        const next: User = {
          ...profile,
          name: profile.name || email.split("@")[0] || "User",
          email: profile.email || email,
          role: profile.role || "User",
        };
        setUser(next);
        return { ok: true, message: "Signed in" };
      } catch (error) {
        clearSessionData();
        setSession(null);
        return {
          ok: false,
          message:
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Sign-in failed. Please try again.",
        };
      }
    },
    [],
  );
  const updateProfile = useCallback(
    (name: string, email: string): LoginResult => {
      if (!user)
        return { ok: false, message: "Sign in to update your profile." };
      if (!name.trim()) return { ok: false, message: "Enter your name." };
      if (!/^\S+@\S+\.\S+$/.test(email.trim()))
        return { ok: false, message: "Enter a valid email address." };
      setUser({ ...user, name: name.trim(), email: email.trim() });
      return { ok: true, message: "Profile updated for this session." };
    },
    [user],
  );
  const logout = useCallback(() => {
    clearLastActivity();
    clearSessionData();
    setSession(null);
    clearSmartxCache();
    clearPlantSettings();
    setUser(null);
  }, []);
  // Page reload while logged in: the saved answer is restored in restoreSession(); if none was saved, fetch it again
  useEffect(() => {
    if (!user || isPlantSettingsLoaded()) return;
    let alive = true;
    void loadPlantSettings(
      user.plantId,
      user.centerStationId || user.stationId || user.vlccIds?.[0],
    ).then(() => {
      if (alive) setUser((u) => (u ? { ...u } : u)); // re-render so pages see the excel version
    });
    return () => {
      alive = false;
    };
  }, [user]);
  const lastActivityRef = useRef<number>(Date.now());
  const loggedIn = !!user;
  useEffect(() => {
    if (!loggedIn) return;
    const stored = readLastActivity();
    if (stored && Date.now() - stored >= IDLE_LIMIT_MS) {
      logout();
      return;
    }
    lastActivityRef.current = stored || Date.now();
    if (!stored) writeLastActivity(lastActivityRef.current);
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      writeLastActivity(now);
    };
    const checkIdle = () => {
      const last = Math.max(lastActivityRef.current, readLastActivity());
      if (Date.now() - last >= IDLE_LIMIT_MS) logout();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true, capture: true }),
    );
    window.addEventListener("focus", checkIdle);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(checkIdle, IDLE_CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, onActivity, { capture: true }),
      );
      window.removeEventListener("focus", checkIdle);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [loggedIn, logout]);
  const value = useMemo(
    () => ({ user, login, updateProfile, logout }),
    [user, login, updateProfile, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
