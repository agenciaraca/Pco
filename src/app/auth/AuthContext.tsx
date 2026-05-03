import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Role } from '../types/schema';
import * as api from '../data/api';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  logoutAllDevices: () => Promise<void>;
  patchUser: (patch: Partial<AuthUser>) => void;
}

const STORAGE_KEY = 'ava-pco-auth';

interface StoredSession {
  user: AuthUser;
  token: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readSession();
    if (session?.user) setUser(session.user);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, token } = await api.login(email, password);
    const stored: StoredSession = { user: u as AuthUser, token };
    writeSession(stored);
    setUser(u as AuthUser);
    return u as AuthUser;
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setUser(null);
  }, []);

  const logoutAllDevices = useCallback(async () => {
    try {
      await api.logoutAllDevices();
    } finally {
      writeSession(null);
      setUser(null);
    }
  }, []);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const session = readSession();
      if (session) writeSession({ ...session, user: next });
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, logoutAllDevices, patchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
