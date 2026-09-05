import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'BUYER' | 'MERCHANT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  merchant_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role: UserRole; merchantName?: string }) => Promise<void>;
  logout: () => void;
  demoLogin: (role: UserRole) => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('agentcart_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify session on load
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('agentcart_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(savedToken);
        } else {
          // Token invalid or expired
          localStorage.removeItem('agentcart_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Session verification network error, keeping local state if exists:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }

    localStorage.setItem('agentcart_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (input: { email: string; password: string; name: string; role: UserRole; merchantName?: string }) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Registration failed');
    }

    localStorage.setItem('agentcart_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('agentcart_token');
    setToken(null);
    setUser(null);
    fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' }).catch(() => {});
  };

  const demoLogin = async (role: UserRole) => {
    if (role === 'BUYER') {
      await login('rahul@runner.ai', 'password123');
    } else {
      await login('merchant@urbanfit.ai', 'password123');
    }
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        demoLogin,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
