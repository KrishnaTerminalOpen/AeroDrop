import React, { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { generateInitials } from '../../utils/formatters';
import { verifyEmailDetailed } from '../../utils/validators';
import InvalidEmailModal from '../InvalidEmailModal';
import {
  initGoogleIdentityServices,
  triggerGoogleAccountPicker,
  getSavedGoogleAccounts,
  saveGoogleAccount,
} from '../../utils/googleAuth';

const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.43 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.43l4.03-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.57 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

export default function AuthModal({ isOpen, onClose, showToast }) {
  const { login, register, loginWithGoogle, sendOtp, verifyOtp } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email Validation & Invalid Email Modal States
  const [emailValidation, setEmailValidation] = useState(null);
  const [showInvalidEmailModal, setShowInvalidEmailModal] = useState(false);
  const [invalidEmailDetails, setInvalidEmailDetails] = useState({ email: '', reason: '', suggestion: null });

  // Real-time email validation feedback as user types
  React.useEffect(() => {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      setEmailValidation(null);
      return;
    }
    if (trimmed.length >= 4) {
      const check = verifyEmailDetailed(trimmed);
      setEmailValidation(check);
    } else {
      setEmailValidation(null);
    }
  }, [email]);

  // Google & OTP states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState(() => getSavedGoogleAccounts());
  const [showManualGoogleInput, setShowManualGoogleInput] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      initGoogleIdentityServices({
        onCredential: (googleUser) => {
          handleDirectGoogleLogin(googleUser);
        },
        onError: (err) => {
          console.log('[GoogleAuth] GIS notification:', err);
        },
      });
    }
  }, [isOpen]);

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmailInput, setOtpEmailInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  const [otpSuccess, setOtpSuccess] = useState('');
  const otpRefs = React.useRef([]);

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  React.useEffect(() => {
    let t;
    if (otpCountdown > 0) {
      t = setInterval(() => setOtpCountdown((c) => Math.max(c - 1, 0)), 1000);
    }
    return () => clearInterval(t);
  }, [otpCountdown]);

  if (!isOpen) return null;

  // Real-time password criteria
  const isMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const strengthScore = [isMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrongEnough = strengthScore >= 4 && isMinLength;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorInfo(null);

    // 1. Strict Email Validity Verification - Trigger Instant Pop-up on Invalid / Fake Email
    const emailCheck = verifyEmailDetailed(email);
    if (!emailCheck.valid) {
      setInvalidEmailDetails({
        email: email.trim(),
        reason: emailCheck.reason,
        suggestion: emailCheck.suggestion || null,
      });
      setShowInvalidEmailModal(true);
      showToast?.({
        type: 'error',
        title: 'Invalid Email ID',
        message: emailCheck.reason,
      });
      return;
    }

    if (tab === 'register') {
      if (!isMinLength) {
        setErrorInfo({
          message: 'Password must be at least 8 characters long.',
          code: 'WEAK_PASSWORD',
        });
        return;
      }
      if (!hasUpper || !hasLower || !hasNumber) {
        setErrorInfo({
          message: 'Password must contain uppercase letters, lowercase letters, and at least one number.',
          code: 'WEAK_PASSWORD',
        });
        return;
      }
      if (password !== confirmPassword) {
        setErrorInfo({
          message: 'Passwords do not match. Please verify both fields.',
          code: 'PASSWORD_MISMATCH',
        });
        return;
      }
    }

    setLoading(true);

    try {
      if (tab === 'login') {
        const user = await login(email, password);
        showToast?.({
          type: 'success',
          title: 'Welcome Back!',
          message: `Logged in as ${user.displayName}`,
        });
      } else {
        const user = await register(email, password, displayName);
        showToast?.({
          type: 'success',
          title: 'Account Created!',
          message: `Signed in as ${user.displayName}`,
        });
      }
      onClose();
    } catch (err) {
      setErrorInfo({
        message: err.message || 'Authentication failed',
        code: err.code || 'AUTH_FAILED',
        email: email.trim().toLowerCase(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = () => {
    setErrorInfo(null);
    setGoogleLoading(true);

    triggerGoogleAccountPicker({
      onCredential: async (googleUser) => {
        await handleDirectGoogleLogin(googleUser);
      },
      onFallbackModal: () => {
        setGoogleLoading(false);
        const currentAccounts = getSavedGoogleAccounts();
        setGoogleAccounts(currentAccounts);
        setShowManualGoogleInput(currentAccounts.length === 0);
        setShowGoogleModal(true);
      },
      onError: (err) => {
        setGoogleLoading(false);
        console.warn('[GoogleAuth] Picker error:', err);
        setShowGoogleModal(true);
      },
    });
  };

  const handleDirectGoogleLogin = async (acc) => {
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle({
        email: acc.email,
        displayName: acc.displayName || acc.email.split('@')[0],
        avatarUrl: acc.avatarUrl || null,
        credential: acc.credential || null,
        googleId: acc.googleId || null,
      });

      saveGoogleAccount({
        email: acc.email,
        displayName: acc.displayName || user.displayName,
        avatarUrl: acc.avatarUrl || user.avatarUrl,
        googleId: acc.googleId || null,
      });
      setGoogleAccounts(getSavedGoogleAccounts());

      setShowGoogleModal(false);
      showToast?.({
        type: 'success',
        title: 'Google Sign-In Successful!',
        message: `Welcome, ${user.displayName}!`,
      });
      onClose();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: err.message || 'Could not complete Google authentication.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConfirmGoogleLogin = async (e) => {
    e?.preventDefault();
    setGoogleLoading(true);
    try {
      const cleanEmail = googleEmailInput.trim().toLowerCase();
      if (!cleanEmail) throw new Error('Please enter a valid Google email.');
      const user = await loginWithGoogle({
        email: cleanEmail,
        displayName: googleNameInput.trim() || cleanEmail.split('@')[0],
      });

      saveGoogleAccount({
        email: cleanEmail,
        displayName: googleNameInput.trim() || user.displayName,
      });
      setGoogleAccounts(getSavedGoogleAccounts());

      setShowGoogleModal(false);
      showToast?.({
        type: 'success',
        title: 'Google Sign-In Successful!',
        message: `Welcome, ${user.displayName}!`,
      });
      onClose();
    } catch (err) {
      showToast?.({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: err.message,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const target = (otpEmailInput || email).trim().toLowerCase();
    if (!target) {
      setOtpError('Please enter your email address to receive a verification code.');
      return;
    }
    const check = verifyEmailDetailed(target);
    if (!check.valid) {
      setInvalidEmailDetails({
        email: target,
        reason: check.reason,
        suggestion: check.suggestion || null,
      });
      setShowInvalidEmailModal(true);
      setOtpError(check.reason);
      return;
    }
    setOtpError(null);
    setOtpLoading(true);
    try {
      await sendOtp(target);
      setOtpSent(true);
      setOtpCountdown(60);
      setOtpSuccess(`6-digit verification code sent to ${target}`);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err) {
      setOtpError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpChange = (index, val) => {
    if (val.length > 1) {
      const nums = val.replace(/\D/g, '').slice(0, 6).split('');
      const copy = [...otpDigits];
      nums.forEach((n, i) => { if (i < 6) copy[i] = n; });
      setOtpDigits(copy);
      const nextIdx = Math.min(nums.length, 5);
      otpRefs.current[nextIdx]?.focus();
      return;
    }
    const clean = val.replace(/\D/g, '');
    const copy = [...otpDigits];
    copy[index] = clean;
    setOtpDigits(copy);
    if (clean && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }
    const target = (otpEmailInput || email).trim().toLowerCase();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const user = await verifyOtp(target, code, displayName || target.split('@')[0]);
      setShowOtpModal(false);
      showToast?.({
        type: 'success',
        title: 'Signed in with OTP!',
        message: `Welcome, ${user.displayName}!`,
      });
      onClose();
    } catch (err) {
      setOtpError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const previewInitials = displayName ? generateInitials(displayName) : (email ? email.slice(0, 2).toUpperCase() : 'U');

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
          maxWidth: '460px',
          width: '100%',
          boxShadow: 'var(--shadow-card)',
          padding: '28px',
          overflow: 'hidden',
          maxHeight: '90vh',
          overflowY: 'auto',
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
                flexShrink: 0,
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
                Your Display Name *
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
                Email Address *
              </label>
              {emailValidation && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: emailValidation.valid ? '#10B981' : '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {emailValidation.valid ? '✓ Valid format' : '⚠ Invalid email'}
                </span>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: emailValidation
                    ? emailValidation.valid
                      ? '#10B981'
                      : '#EF4444'
                    : 'var(--text-placeholder)',
                }}
              />
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
                  border: emailValidation
                    ? emailValidation.valid
                      ? '1.5px solid #10B981'
                      : '1.5px solid #EF4444'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 150ms ease, border-width 150ms ease',
                }}
              />
            </div>
            {emailValidation && !emailValidation.valid && emailValidation.suggestion && (
              <button
                type="button"
                onClick={() => setEmail(emailValidation.suggestion)}
                style={{
                  marginTop: '5px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px dashed rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: 'var(--accent-primary, #6366f1)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span>💡 Typo detected! Did you mean <strong>{emailValidation.suggestion}</strong>? (Click to apply)</span>
              </button>
            )}
            {emailValidation && !emailValidation.valid && !emailValidation.suggestion && (
              <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#EF4444', fontWeight: 500 }}>
                {emailValidation.reason}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
                Password *
              </label>
              {tab === 'register' && (
                <span style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                  Min 8 chars, mixed case & numbers
                </span>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={tab === 'register' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'login' ? 'Enter password' : 'Create strong password'}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 38px 0 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="touch-target"
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-placeholder)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Registration only) */}
          {tab === 'register' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
                  Confirm Password *
                </label>
                {passwordsMatch && (
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Check size={12} strokeWidth={3} /> Match
                  </span>
                )}
                {passwordMismatch && (
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                    Does not match
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 38px 0 38px',
                    borderRadius: '10px',
                    border: passwordMismatch
                      ? '1px solid #ef4444'
                      : passwordsMatch
                      ? '1px solid #10b981'
                      : '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="touch-target"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-placeholder)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (tab === 'register' && (!isStrongEnough || password !== confirmPassword))}
            className="touch-target btn-press"
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '10px',
              backgroundColor:
                tab === 'register' && (!isStrongEnough || password !== confirmPassword)
                  ? 'var(--bg-card-subtle)'
                  : 'var(--accent-primary)',
              color:
                tab === 'register' && (!isStrongEnough || password !== confirmPassword)
                  ? 'var(--text-placeholder)'
                  : '#ffffff',
              border:
                tab === 'register' && (!isStrongEnough || password !== confirmPassword)
                  ? '1px solid var(--border-subtle)'
                  : 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor:
                loading || (tab === 'register' && (!isStrongEnough || password !== confirmPassword))
                  ? 'not-allowed'
                  : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {tab === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        {/* Divider: OR CONTINUE WITH */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0 16px 0',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-placeholder)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            or continue with
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        {/* Bottom Row: Google (one side) & OTP (other side of the same row) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {/* Left Side: Google */}
          <button
            type="button"
            onClick={handleGoogleClick}
            className="touch-target btn-press"
            style={{
              height: '44px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              padding: '0 8px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <GoogleIcon size={17} />
            <span>{tab === 'register' ? 'Google' : 'Google'}</span>
          </button>

          {/* Right Side: Email OTP */}
          <button
            type="button"
            onClick={() => {
              setOtpEmailInput(email || '');
              setOtpSent(false);
              setOtpDigits(['', '', '', '', '', '']);
              setOtpError(null);
              setOtpSuccess('');
              setShowOtpModal(true);
            }}
            className="touch-target btn-press"
            style={{
              height: '44px',
              borderRadius: '10px',
              border: '1.5px solid rgba(79, 70, 229, 0.4)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              padding: '0 8px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <KeyRound size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>{tab === 'register' ? 'Email OTP' : 'Email OTP'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================================
          GOOGLE SIGN-IN POPUP MODAL (Account Chooser)
         ====================================================================== */}
      {showGoogleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !googleLoading) setShowGoogleModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '390px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '22px',
              padding: '28px 24px',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <GoogleIcon size={34} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
              Choose an account
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              to continue to <strong style={{ color: 'var(--text-main)' }}>AeroDrop</strong>
            </p>

            {/* List of Detected Google Accounts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {googleAccounts.map((acc, idx) => {
                const initial = (acc.displayName?.[0] || acc.email[0] || 'G').toUpperCase();
                return (
                  <button
                    key={acc.email + idx}
                    type="button"
                    disabled={googleLoading}
                    onClick={() => handleDirectGoogleLogin(acc)}
                    className="touch-target btn-press"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1.5px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: googleLoading ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {acc.avatarUrl ? (
                      <img
                        src={acc.avatarUrl}
                        alt={acc.displayName}
                        style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #4285f4 0%, #06b6d4 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '15px',
                          flexShrink: 0,
                        }}
                      >
                        {initial}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {acc.displayName || acc.email.split('@')[0]}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {acc.email}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        backgroundColor: 'rgba(34, 197, 94, 0.12)',
                        color: '#16a34a',
                        flexShrink: 0,
                      }}
                    >
                      Active
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Use Another Account Button or Form */}
            {!showManualGoogleInput ? (
              <button
                type="button"
                onClick={() => setShowManualGoogleInput(true)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                }}
              >
                <span>+</span> Use another Google account
              </button>
            ) : (
              <form onSubmit={handleConfirmGoogleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', textAlign: 'left' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Google Email
                  </label>
                  <input
                    type="email"
                    required
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={googleNameInput}
                    onChange={(e) => setGoogleNameInput(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowManualGoogleInput(false)}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={googleLoading}
                    style={{
                      flex: 2,
                      height: '38px',
                      borderRadius: '9999px',
                      border: 'none',
                      backgroundColor: '#1a73e8',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: googleLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {googleLoading ? 'Connecting...' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '14px 0 16px 0' }}>
              To continue, Google will securely share your name and email address with AeroDrop.
            </div>

            <button
              type="button"
              disabled={googleLoading}
              onClick={() => setShowGoogleModal(false)}
              style={{
                width: '100%',
                height: '40px',
                borderRadius: '9999px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
          EMAIL OTP VERIFICATION POPUP MODAL
         ====================================================================== */}
      {showOtpModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOtpModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              padding: '28px',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              textAlign: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-placeholder)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>

            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              }}
            >
              <KeyRound size={20} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
              {otpSent ? 'Enter Verification Code' : 'Sign In with Email OTP'}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 18px 0' }}>
              {otpSent
                ? `Enter the 6-digit code sent to ${otpEmailInput || email}`
                : 'Enter your email address to receive an instant 6-digit code.'}
            </p>

            {otpError && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  fontSize: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '12px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                }}
              >
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>{otpSuccess}</span>
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={otpEmailInput}
                      onChange={(e) => setOtpEmailInput(e.target.value)}
                      placeholder="you@company.com"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 12px 0 38px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: otpLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {otpLoading ? <span>Sending Code...</span> : <span>Send 6-Digit Code</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    margin: '4px 0',
                  }}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      style={{
                        width: '42px',
                        height: '50px',
                        borderRadius: '10px',
                        border: digit
                          ? '2px solid var(--accent-primary)'
                          : '1.5px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        textAlign: 'center',
                        fontSize: '20px',
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otpDigits.join('').length !== 6}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor:
                      otpDigits.join('').length === 6
                        ? 'var(--accent-primary)'
                        : 'var(--bg-card-subtle)',
                    color: otpDigits.join('').length === 6 ? '#ffffff' : 'var(--text-placeholder)',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: otpDigits.join('').length === 6 && !otpLoading ? 'pointer' : 'not-allowed',
                  }}
                >
                  {otpLoading ? <span>Verifying...</span> : <span>Verify & Sign In</span>}
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpDigits(['', '', '', '', '', '']);
                      setOtpError(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-placeholder)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    disabled={otpCountdown > 0 || otpLoading}
                    onClick={handleSendOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: otpCountdown > 0 ? 'var(--text-placeholder)' : 'var(--accent-primary)',
                      cursor: otpCountdown > 0 ? 'default' : 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>{otpCountdown > 0 ? `Resend in ${otpCountdown}s` : 'Resend Code'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Pop-up modal for invalid email id */}
      <InvalidEmailModal
        isOpen={showInvalidEmailModal}
        onClose={() => setShowInvalidEmailModal(false)}
        email={invalidEmailDetails.email}
        reason={invalidEmailDetails.reason}
        suggestion={invalidEmailDetails.suggestion}
        onApplySuggestion={(sug) => {
          setEmail(sug);
          setShowInvalidEmailModal(false);
        }}
      />
    </div>
  );
}
