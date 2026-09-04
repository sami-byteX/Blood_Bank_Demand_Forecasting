import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearAccessToken, setAccessToken } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);    // { id, email, full_name, role }
  const [ready, setReady]     = useState(false);   // true once boot-check done
  const [loading, setLoading] = useState(false);

  // ── logout (also called on session expiry) ──────────────────────────────
  const logout = useCallback(() => {
    clearAccessToken();
    localStorage.removeItem('bb_refresh');
    setUser(null);
  }, []);

  // ── listen for session expiry events from axios interceptor ─────────────
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('bb:session-expired', handler);
    return () => window.removeEventListener('bb:session-expired', handler);
  }, [logout]);

  // ── boot: attempt silent refresh on page load ────────────────────────────
  useEffect(() => {
    (async () => {
      const refresh = localStorage.getItem('bb_refresh');
      if (!refresh) { setReady(true); return; }
      try {
        const { data } = await api.post('/auth/refresh/', { refresh });
        setAccessToken(data.access);
        if (data.refresh) localStorage.setItem('bb_refresh', data.refresh);
        const me = await api.get('/auth/me/');
        setUser(me.data);
      } catch {
        clearAccessToken();
        localStorage.removeItem('bb_refresh');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ── login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', { email, password });
      setAccessToken(data.access);
      localStorage.setItem('bb_refresh', data.refresh);
      const me = await api.get('/auth/me/');
      setUser(me.data);
      return me.data;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
