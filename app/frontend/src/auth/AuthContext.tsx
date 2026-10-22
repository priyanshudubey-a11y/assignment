import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, type User } from '../api/client';

type Status = 'loading' | 'authenticated' | 'anonymous' | 'error';

interface AuthValue {
  status: Status;
  user: User | null;
  /** True after an explicit logout, so the redirect to login does not carry a `next`. */
  loggedOut: boolean;
  /** Throws ApiError on failure; on success the user state is set. */
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Session bootstrap: nothing protected renders until /api/me answers.
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getMe(ctrl.signal)
      .then((r) => {
        setUser(r.user);
        setStatus('authenticated');
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (e?.status === 401) {
          setUser(null);
          setStatus('anonymous');
        } else setStatus('error');
      });
    return () => ctrl.abort();
  }, [attempt]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    setUser(r.user);
    setLoggedOut(false);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if the call fails, drop local state so no protected content stays on screen.
    }
    setLoggedOut(true);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ status, user, loggedOut, signIn, signOut, retry }), [status, user, loggedOut, signIn, signOut, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
