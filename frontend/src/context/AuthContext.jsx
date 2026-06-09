// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axiosInstance from '../config/axios';
import API_ENDPOINTS from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// ─── token helpers ────────────────────────────────────────────────────────────

const loadFromStorage = () => {
  try {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    return {
      user: user ? JSON.parse(user) : null,
      token: token || null,
      refreshToken: refreshToken || null,
    };
  } catch {
    return { user: null, token: null, refreshToken: null };
  }
};

const persistToStorage = (user, token, refreshToken) => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
};

const clearStorage = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

// ─── provider ────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const stored = loadFromStorage();
  const [user, setUser] = useState(stored.user);
  const [token, setToken] = useState(stored.token);
  const [loading, setLoading] = useState(true);

  // Wired logout so interceptor can call it via custom event
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearStorage();
  }, []);

  // On mount: validate / silently refresh the stored access token
  useEffect(() => {
    const init = async () => {
      const { user: savedUser, token: savedToken, refreshToken: savedRefresh } = loadFromStorage();

      if (!savedToken && !savedRefresh) {
        setLoading(false);
        return;
      }

      try {
        // Try to verify the access token
        const res = await axiosInstance.post(API_ENDPOINTS.VERIFY, null, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (res.data.success) {
          const freshUser = res.data.user;
          setUser(freshUser);
          setToken(savedToken);
          persistToStorage(freshUser, savedToken, savedRefresh);
        } else {
          logout();
        }
      } catch (err) {
        // If verify fails with 401, the axios interceptor will auto-refresh.
        // If even that fails, the auth:logout event fires → logout() is called below.
        // If it succeeded after silent refresh, we just restore from storage again.
        const refreshed = loadFromStorage();
        if (refreshed.token && refreshed.user) {
          setUser(refreshed.user);
          setToken(refreshed.token);
        } else {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for the interceptor's forced-logout signal
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  // ─── login ──────────────────────────────────────────────────────────────────

  const login = async (identifier, password) => {
    try {
      const response = await axiosInstance.post(API_ENDPOINTS.LOGIN, { identifier, password });

      if (!response.data.success) {
        return { success: false, message: response.data.message || 'Login failed' };
      }

      const userData = response.data.user;
      const accessToken = response.data.token;
      const refreshToken = response.data.refreshToken;

      setUser(userData);
      setToken(accessToken);
      persistToStorage(userData, accessToken, refreshToken);

      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed. Please try again.',
      };
    }
  };

  // ─── value ──────────────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
