import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('aerodrop_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('aerodrop_token') || null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
        } else {
          logout();
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'Backend route not found'}`);
    }
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    return data.user;
  };

  const register = async (email, password, displayName) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'Backend route not found'}`);
    }
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    return data.user;
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('aerodrop_user');
    localStorage.removeItem('aerodrop_token');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: Boolean(currentUser && token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
