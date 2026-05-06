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
  totpEnabled?: boolean;
}

interface ImpersonationState {
  /** Admin original que iniciou a sessão. */
  actor: { id: string; email: string; role: Role };
  /** Usuário que está sendo visualizado. */
  target: { id: string; email: string; role: Role; name: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** null se sessão atual não é impersonation. */
  impersonation: ImpersonationState | null;
  login: (
    email: string,
    password: string,
  ) => Promise<AuthUser | { totpRequired: true; ticket: string }>;
  completeTotpLogin: (ticket: string, code: string) => Promise<AuthUser>;
  logout: () => void;
  logoutAllDevices: () => Promise<void>;
  patchUser: (patch: Partial<AuthUser>) => void;
  /**
   * Admin/superadmin "entra" como aluno. Guarda sessão original em
   * sessionStorage e troca o token. Redireciona pro dashboard student.
   */
  startImpersonation: (targetUserId: string) => Promise<void>;
  /** Restaura sessão do admin original. Redireciona pro dashboard admin. */
  exitImpersonation: () => Promise<void>;
}

const STORAGE_KEY = 'ava-pco-auth';
/** Sessão original do admin, guardada em sessionStorage durante impersonation. */
const ORIGINAL_SESSION_KEY = 'ava-pco-original-session';

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
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);

  useEffect(() => {
    const session = readSession();
    if (session?.user) setUser(session.user);
    setLoading(false);
  }, []);

  // Detecta se sessão atual é impersonation (consulta backend)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .getImpersonationStatus()
      .then((r) => {
        if (cancelled) return;
        if (r.impersonating && r.actor && r.target) {
          setImpersonation({
            actor: r.actor,
            target: { ...r.target, name: user.name },
          });
        } else {
          setImpersonation(null);
        }
      })
      .catch(() => {
        if (!cancelled) setImpersonation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Quando o http client detecta 401, faz logout local
  useEffect(() => {
    function handleExpired() {
      const had = readSession();
      if (!had) return;
      writeSession(null);
      setUser(null);
      // Redireciona pra /login com mensagem (toast informativo via flag em sessionStorage)
      try {
        sessionStorage.setItem('auth:expired:reason', 'session-expired');
      } catch {
        // ignora
      }
      if (location.pathname !== '/login') {
        location.assign('/login');
      }
    }
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<AuthUser | { totpRequired: true; ticket: string }> => {
      const res = await api.login(email, password);
      if (res.totpRequired && res.ticket) {
        return { totpRequired: true, ticket: res.ticket };
      }
      if (!res.user || !res.token) {
        throw new Error('Resposta de login inválida.');
      }
      const stored: StoredSession = { user: res.user as AuthUser, token: res.token };
      writeSession(stored);
      setUser(res.user as AuthUser);
      return res.user as AuthUser;
    },
    [],
  );

  const completeTotpLogin = useCallback(
    async (ticket: string, code: string): Promise<AuthUser> => {
      const { user: u, token } = await api.loginVerifyTotp(ticket, code);
      const stored: StoredSession = { user: u as AuthUser, token };
      writeSession(stored);
      setUser(u as AuthUser);
      return u as AuthUser;
    },
    [],
  );

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

  const startImpersonation = useCallback(async (targetUserId: string) => {
    const original = readSession();
    if (!original) throw new Error('Sessão não encontrada.');

    const result = await api.startImpersonation(targetUserId);

    // Guarda sessão original em sessionStorage (sobrevive a refresh, mas
    // não a fechar o navegador — o que é o comportamento desejado).
    try {
      sessionStorage.setItem(ORIGINAL_SESSION_KEY, JSON.stringify(original));
    } catch {
      /* ignore */
    }

    const targetSession: StoredSession = {
      user: {
        id: result.target.id,
        email: result.target.email,
        name: result.target.name,
        role: result.target.role,
      },
      token: result.token,
    };
    writeSession(targetSession);
    setUser(targetSession.user);
    setImpersonation({
      actor: result.actor,
      target: result.target,
    });
    // Redireciona pra área do aluno
    location.assign('/dashboard');
  }, []);

  const exitImpersonation = useCallback(async () => {
    const result = await api.exitImpersonation();
    let original: StoredSession | null = null;
    try {
      const raw = sessionStorage.getItem(ORIGINAL_SESSION_KEY);
      if (raw) original = JSON.parse(raw) as StoredSession;
      sessionStorage.removeItem(ORIGINAL_SESSION_KEY);
    } catch {
      /* ignore */
    }

    if (original) {
      // Atualiza com token novo (rotacionado pelo backend)
      const restored: StoredSession = { ...original, token: result.token };
      writeSession(restored);
      setUser(restored.user);
    }
    setImpersonation(null);
    location.assign('/admin/dashboard');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        impersonation,
        login,
        completeTotpLogin,
        logout,
        logoutAllDevices,
        patchUser,
        startImpersonation,
        exitImpersonation,
      }}
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
