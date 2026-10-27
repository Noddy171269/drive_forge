import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const persist = useCallback((t, u) => {
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
    setToken(t || null);
    setUser(u || null);
  }, []);

  // On mount, if we have a token, confirm it's still valid.
  useEffect(() => {
    let active = true;
    async function check() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (active) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } catch {
        if (active) persist(null, null);
      } finally {
        if (active) setLoading(false);
      }
    }
    check();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    persist(data.token, data.user);
    return data.user;
  };

  const register = async (email, password) => {
    const { data } = await api.post('/auth/register', { email, password });
    persist(data.token, data.user);
    return data.user;
  };

  const logout = () => persist(null, null);

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
