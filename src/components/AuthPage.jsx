import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Users,
  LogOut,
  Send,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { generateInitials } from '../utils/formatters';

// Pre-seeded quick test accounts for fast 1-click verification of multi-user chat
const DEMO_ACCOUNTS = [
  {
    name: 'Alice Walker',
    email: 'alice.walker@company.io',
    password: 'password123',
    color: '#4f46e5',
    role: 'Product Lead'
  },
  {
    name: 'Bob Chen',
    email: 'bob.chen@designstudio.org',
    password: 'securepass456',
    color: '#0284c7',
    role: 'UI Designer'
  }
];

export default function AuthPage({ initialMode = 'login', onNavigate, showToast }) {
  const { currentUser, login, register, logout, isAuthenticated } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null); // { message, code, email }
  const [successMsg, setSuccessMsg] = useState('');

  // Keep mode in sync if initialMode prop changes (e.g. from hash change)
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setErrorInfo(null);
    }
  }, [initialMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await login(email, password);
        setSuccessMsg(`Welcome back, ${user.displayName}! Redirecting...`);
        showToast?.({
          type: 'success',
          title: 'Welcome Back!',
          message: `Logged in as ${user.displayName}`,
        });
        setTimeout(() => {
          if (onNavigate) onNavigate('chat');
        }, 600);
      } else {
        const user = await register(email, password, displayName);
        setSuccessMsg(`Account created for ${user.displayName}! Redirecting...`);
        showToast?.({
          type: 'success',
          title: 'Account Created!',
          message: `Signed in as ${user.displayName}`,
        });
        setTimeout(() => {
          if (onNavigate) onNavigate('chat');
        }, 600);
      }
    } catch (err) {
      setErrorInfo({
        message: err.message || 'Authentication failed. Please check your credentials.',
        code: err.code || 'UNKNOWN_ERROR',
        email: email.trim().toLowerCase(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demo) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setErrorInfo(null);
    setLoading(true);
    try {
      const user = await login(demo.email, demo.password);
      showToast?.({
        type: 'success',
        title: `Logged in as ${demo.name}`,
        message: 'Instant session authenticated for multi-user test.',
      });
      if (onNavigate) onNavigate('chat');
    } catch (err) {
      setErrorInfo({
        message: err.message || 'Demo login failed.',
        code: err.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToLoginWithEmail = (targetEmail) => {
    setMode('login');
    if (targetEmail) setEmail(targetEmail);
    setErrorInfo(null);
  };

  const handleSwitchToRegisterWithEmail = (targetEmail) => {
    setMode('register');
    if (targetEmail) setEmail(targetEmail);
    setErrorInfo(null);
  };

  const previewInitials = displayName ? generateInitials(displayName) : (email ? email.slice(0, 2).toUpperCase() : 'U');

  return (
    <div
      className="animate-fade-up"
      style={{
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '12px 16px',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 24px var(--accent-glow)',
            marginBottom: '14px',
          }}
        >
          <Send size={28} style={{ transform: 'rotate(-10deg) translateX(1px)' }} />
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', margin: 0 }}>
          {mode === 'login' ? 'Sign In to AeroDrop' : 'Create an AeroDrop Account'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Secure sessions • Instant file transfers • Real-time group chat attribution
        </p>
      </div>

      {/* Main Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          padding: '32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* If user is ALREADY logged in: display profile banner with instant switch/logout option */}
        {isAuthenticated && currentUser && (
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: currentUser.color || '#4f46e5',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {currentUser.initials}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {currentUser.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-placeholder)' }}>
                    {currentUser.email}
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: '#10b98120',
                  color: '#10b981',
                  border: '1px solid #10b98140',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                ● Active
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onNavigate?.('chat')}
                className="touch-target btn-press"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <MessageSquare size={14} />
                <span>Go to Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setErrorInfo(null);
                  showToast?.({ type: 'info', title: 'Signed Out', message: 'You have been logged out.' });
                }}
                className="touch-target btn-press"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={14} />
                <span>Switch / Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Switcher: Log In vs Sign Up */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorInfo(null);
            }}
            className="touch-target"
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'login' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'login' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorInfo(null);
            }}
            className="touch-target"
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: mode === 'register' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'register' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: mode === 'register' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={15} />
            <span>Create Account</span>
          </button>
        </div>

        {/* Live Initials Preview during registration */}
        {mode === 'register' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '20px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '17px',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0,
              }}
            >
              {previewInitials}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {displayName.trim() ? displayName : 'Your Public Attribution'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                Every message and shared transfer will display your verified identity.
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: '#10b98118',
              color: '#10b981',
              border: '1px solid #10b98135',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '18px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Smart Error Alert with Contextual Action */}
        {errorInfo && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              color: 'var(--color-error)',
              fontSize: '13px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {errorInfo.message}
                </div>

                {/* If account already exists: provide 1-click switch to Log In */}
                {errorInfo.code === 'EMAIL_EXISTS' && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleSwitchToLoginWithEmail(email)}
                      className="touch-target btn-press"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Log In with {email || 'this email'} instead</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}

                {/* If user not found during login: provide 1-click switch to Sign Up */}
                {errorInfo.code === 'USER_NOT_FOUND' && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleSwitchToRegisterWithEmail(email)}
                      className="touch-target btn-press"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Create a new account with {email || 'this email'}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Display Name field (Registration only) */}
          {mode === 'register' && (
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Your Display Name *
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-placeholder)' }} />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 14px 0 42px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 150ms ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email Address field */}
          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Email Address *
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-placeholder)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 14px 0 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  display: 'block',
                }}
              >
                Password *
              </label>
              {mode === 'register' && (
                <span style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                  Min 6 characters
                </span>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-placeholder)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a secure password'}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 42px 0 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="touch-target"
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-placeholder)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="touch-target btn-press"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 150ms ease',
            }}
          >
            {loading ? (
              <span>Processing...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} />
                <span>Sign In to Account</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Create New Account</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Test Drawer */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-placeholder)' }}>
              ⚡ 1-Click Multi-User Test Accounts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => handleQuickDemoLogin(demo)}
                className="touch-target btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: demo.color,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '11px',
                    flexShrink: 0,
                  }}
                >
                  {demo.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {demo.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-placeholder)' }}>
                    {demo.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
