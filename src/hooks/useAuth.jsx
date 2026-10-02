import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(null);

// Background chat pre-warming function
export async function prefetchChatData(authToken, userId) {
  if (!authToken) return;
  try {
    const res = await fetch('/api/chat/rooms', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const rawRooms = data.rooms || [];
      const rooms = rawRooms.filter((r) => {
        if (r.type === 'direct') {
          const text = r.lastMessageText?.trim();
          return text && text !== 'Conversation started' && text !== 'No messages yet';
        }
        return true;
      });
      if (rooms.length > 0) {
        try {
          localStorage.setItem('aerodrop_cached_rooms', JSON.stringify(rooms));
          if (userId) {
            localStorage.setItem(`aerodrop_cached_rooms_${userId}`, JSON.stringify(rooms));
          }
        } catch (e) {}

        const activeRoom = rooms.find((r) => r.type === 'group') || rooms[0];
        if (activeRoom) {
          try {
            localStorage.setItem('aerodrop_cached_active_room_id', activeRoom.id);
          } catch (e) {}
        }

        rooms.slice(0, 5).forEach((r) => {
          fetch(`/api/chat/rooms/${r.id}/messages`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.messages) {
                try {
                  localStorage.setItem(`aerodrop_cached_msgs_${r.id}`, JSON.stringify(d.messages.slice(-100)));
                } catch (e) {}
              }
            })
            .catch(() => {});
        });
      }
    }
  } catch (e) {}
}

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

  // Only show blocking loader if token exists but cached user object has not yet been resolved
  const [loading, setLoading] = useState(() => {
    try {
      const stored = localStorage.getItem('aerodrop_user');
      const storedTok = localStorage.getItem('aerodrop_token');
      return Boolean(storedTok && !stored);
    } catch (e) {
      return false;
    }
  });

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
          prefetchChatData(token, data.user?.id);
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
      const err = new Error(data.error || 'Login failed');
      err.code = data.code || 'LOGIN_FAILED';
      err.email = data.email || email;
      throw err;
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    prefetchChatData(data.token, data.user?.id);
    return data.user;
  };

  const register = async (email, password, displayName, otp) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, otp }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'Backend route not found'}`);
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Registration failed');
      err.code = data.code || 'REGISTER_FAILED';
      err.email = data.email || email;
      throw err;
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    prefetchChatData(data.token, data.user?.id);
    return data.user;
  };

  const updateProfile = async (updates) => {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
      localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
      return data.user;
    } else {
      throw new Error('Failed to update profile');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    try {
      localStorage.removeItem('aerodrop_user');
      localStorage.removeItem('aerodrop_token');
      localStorage.removeItem('aerodrop_cached_rooms');
      localStorage.removeItem('aerodrop_cached_active_room_id');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('aerodrop_cached_msgs_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  };

  const loginWithGoogle = async ({ email, displayName, avatarUrl, credential, googleId }) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName, avatarUrl, credential, googleId }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'Google sign-in route error'}`);
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Google sign-in failed');
      err.code = data.code || 'GOOGLE_AUTH_FAILED';
      throw err;
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    prefetchChatData(data.token, data.user?.id);
    return data.user;
  };

  const sendOtp = async (email) => {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'OTP send route error'}`);
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Failed to dispatch verification code');
      err.code = data.code || 'OTP_SEND_FAILED';
      throw err;
    }
    return data;
  };

  const verifyOtp = async (email, otp, displayName) => {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp, displayName }),
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status}: ${res.statusText || 'OTP verify route error'}`);
    }
    if (!res.ok) {
      const err = new Error(data.error || 'Invalid or expired verification code');
      err.code = data.code || 'OTP_VERIFY_FAILED';
      throw err;
    }
    setCurrentUser(data.user);
    setToken(data.token);
    localStorage.setItem('aerodrop_user', JSON.stringify(data.user));
    localStorage.setItem('aerodrop_token', data.token);
    prefetchChatData(data.token, data.user?.id);
    return data.user;
  };

  const checkAvailability = async ({ email, displayName, currentUserId }) => {
    try {
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (displayName) params.set('displayName', displayName);
      if (currentUserId) params.set('currentUserId', currentUserId);
      const res = await fetch(`/api/auth/check-availability?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      return { emailAvailable: true, nameAvailable: true };
    } catch (e) {
      return { emailAvailable: true, nameAvailable: true };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        loading,
        login,
        register,
        loginWithGoogle,
        sendOtp,
        verifyOtp,
        logout,
        updateProfile,
        checkAvailability,
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
