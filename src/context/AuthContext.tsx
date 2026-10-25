import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  mfaEnabled?: boolean;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, totp?: string) => Promise<void>;
  refresh: () => Promise<void>;
  setToken: (token: string) => void;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const saved = localStorage.getItem('user');
    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('user');
    localStorage.removeItem('companyId');
      }
      api.get('/auth/me').then((res) => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      }).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string, totp?: string) => {
    const res = await api.post('/auth/login', { username, password, ...(totp ? { totp } : {}) });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const setToken = (token: string) => localStorage.setItem('token', token);

  const refresh = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    localStorage.setItem('user', JSON.stringify(res.data));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword });
    if (res.data?.token) setToken(res.data.token);
    await refresh();
  };

  const hasPermission = (code: string) => {
    if (!user) return false;
    if (user.permissions.includes('system.admin')) return true;
    return user.permissions.includes(code);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword, hasPermission, refresh, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
