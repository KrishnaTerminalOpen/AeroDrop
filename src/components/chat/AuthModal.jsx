import React, { useState } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { generateInitials } from '../../utils/formatters';

export default function AuthModal({ isOpen, onClose, showToast }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const user = await login(email, password);
        showToast({
          type: 'success',
          title: 'Welcome Back!',
          message: `Logged in as ${user.displayName}`,
        });
      } else {
        const user = await register(email, password, displayName);
        showToast({
          type: 'success',
          title: 'Account Created!',
          message: `Signed in as ${user.displayName}`,
        });
      }
      onClose();
    } catch (err) {
      setErrorInfo({
        message: err.message || 'Authentication failed',
        code: err.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const previewInitials = displayName ? displayName.slice(0, 2).toUpperCase() : 'U';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeUp 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '20px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: 'var(--shadow-card)',
          padding: '28px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {tab === 'login' ? 'Sign In to Chat' : 'Create Chat Account'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', margin: '4px 0 0 0' }}>
              Individual authenticated profile with verified attribution
            </p>
          </div>
          <button
            onClick={onClose}
            className="touch-target btn-press"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-placeholder)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorInfo(null);
            }}
            className="touch-target"
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: tab === 'login' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'login' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: tab === 'login' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorInfo(null);
            }}
            className="touch-target"
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: tab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'register' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: tab === 'register' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 150ms ease',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Register Avatar Initials Live Preview */}
        {tab === 'register' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px', padding: '10px 14px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {previewInitials}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Auto-generated initial avatar & unique color assigned to your chat messages
            </div>
          </div>
        )}

        {/* Error Alert with Smart Recovery */}
        {errorInfo && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error-border)',
              color: 'var(--color-error)',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{errorInfo.message}</span>
            </div>

            {errorInfo.code === 'EMAIL_EXISTS' && (
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorInfo(null);
                }}
                className="touch-target btn-press"
                style={{
                  marginTop: '6px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Log In with this email instead →
              </button>
            )}

            {errorInfo.code === 'USER_NOT_FOUND' && (
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorInfo(null);
                }}
                className="touch-target btn-press"
                style={{
                  marginTop: '6px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create an account with this email →
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tab === 'register' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Your Display Name
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 14px 0 38px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px 0 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px 0 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="touch-target btn-press"
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {tab === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
