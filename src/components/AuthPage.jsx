import React, { useState, useEffect, useRef } from 'react';
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
  LogOut,
  Send,
  MessageSquare,
  Check,
  X,
  KeyRound,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { generateInitials } from '../utils/formatters';
import {
  initGoogleIdentityServices,
  triggerGoogleAccountPicker,
  getSavedGoogleAccounts,
  saveGoogleAccount,
} from '../utils/googleAuth';

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

export default function AuthPage({ initialMode = 'login', onNavigate, showToast }) {
  const { currentUser, login, register, logout, isAuthenticated, updateProfile, loginWithGoogle, sendOtp, verifyOtp } = useAuth();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Google sign in states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState(() => getSavedGoogleAccounts());
  const [showManualGoogleInput, setShowManualGoogleInput] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Auto-initialize Google Identity Services (GIS) on mount to listen for browser accounts
  useEffect(() => {
    initGoogleIdentityServices({
      onCredential: (googleUser) => {
        handleDirectGoogleLogin(googleUser);
      },
      onError: (err) => {
        console.log('[GoogleAuth] GIS notification:', err);
      },
    });
  }, []);

  // OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmailInput, setOtpEmailInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  const [otpSuccess, setOtpSuccess] = useState('');
  const otpRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null); // { message, code, email }
  const [successMsg, setSuccessMsg] = useState('');
  const [showSwitchForm, setShowSwitchForm] = useState(false);

  // Countdown timer for OTP
  useEffect(() => {
    let t;
    if (otpCountdown > 0) {
      t = setInterval(() => setOtpCountdown((c) => Math.max(c - 1, 0)), 1000);
    }
    return () => clearInterval(t);
  }, [otpCountdown]);

  // Sync mode with props
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setErrorInfo(null);
    }
  }, [initialMode]);

  // Real-time password criteria evaluation
  const isMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // Score from 0 to 5
  const strengthScore = [isMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrongEnough = strengthScore >= 4 && isMinLength;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMsg('');

    if (mode === 'register') {
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
          message: 'Passwords do not match. Please verify both password fields.',
          code: 'PASSWORD_MISMATCH',
        });
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const user = await login(email, password);
        setSuccessMsg(`Welcome back, ${user.displayName}!`);
        setShowSwitchForm(false);
        showToast?.({
          type: 'success',
          title: 'Welcome Back!',
          message: `Logged in as ${user.displayName}`,
        });
        onNavigate?.('compose');
      } else {
        const user = await register(email, password, displayName);
        setSuccessMsg(`Account created for ${user.displayName}!`);
        setShowSwitchForm(false);
        showToast?.({
          type: 'success',
          title: 'Account Created!',
          message: `Signed in as ${user.displayName}`,
        });
        onNavigate?.('compose');
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

  const handleGoogleClick = () => {
    setErrorInfo(null);
    setGoogleLoading(true);

    // 1. First trigger Google Identity Services / Native Browser Google Account Picker
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

      // Save to remembered accounts for instant 1-click access
      saveGoogleAccount({
        email: acc.email,
        displayName: acc.displayName || user.displayName,
        avatarUrl: acc.avatarUrl || user.avatarUrl,
        googleId: acc.googleId || null,
      });
      setGoogleAccounts(getSavedGoogleAccounts());

      setShowGoogleModal(false);
      onNavigate?.('compose');
      showToast?.({
        type: 'success',
        title: 'Google Sign-In Successful!',
        message: `Welcome, ${user.displayName}!`,
      });
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
      onNavigate?.('compose');
      showToast?.({
        type: 'success',
        title: 'Google Sign-In Successful!',
        message: `Welcome, ${user.displayName}!`,
      });
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
      onNavigate?.('compose');
      showToast?.({
        type: 'success',
        title: 'Signed in with OTP!',
        message: `Welcome, ${user.displayName}!`,
      });
    } catch (err) {
      setOtpError(err.message || 'Invalid verification code. Please check and try again.');
    } finally {
      setOtpLoading(false);
    }
  };


  const handleSwitchToLoginWithEmail = (targetEmail) => {
    setMode('login');
    if (targetEmail) setEmail(targetEmail);
    setPassword('');
    setConfirmPassword('');
    setErrorInfo(null);
  };

  const handleSwitchToRegisterWithEmail = (targetEmail) => {
    setMode('register');
    if (targetEmail) setEmail(targetEmail);
    setPassword('');
    setConfirmPassword('');
    setErrorInfo(null);
  };

  const previewInitials = displayName ? generateInitials(displayName) : (email ? email.slice(0, 2).toUpperCase() : 'U');

  // Strength label & color
  const getStrengthMeta = () => {
    if (strengthScore <= 1) return { label: 'Very Weak', color: '#ef4444', percent: '20%' };
    if (strengthScore === 2) return { label: 'Weak', color: '#f97316', percent: '40%' };
    if (strengthScore === 3) return { label: 'Moderate', color: '#eab308', percent: '65%' };
    if (strengthScore === 4) return { label: 'Strong', color: '#3b82f6', percent: '85%' };
    return { label: 'Very Strong', color: '#10b981', percent: '100%' };
  };

  const strengthMeta = getStrengthMeta();

  return (
    <div
      className="animate-fade-up auth-page-wrapper"
      style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        padding: '0 8px',
        overflow: 'visible',
      }}
    >
      {/* Brand Header */}
      <div className="auth-heading-block" style={{ textAlign: 'center', marginBottom: '14px', flexShrink: 0 }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px var(--accent-glow)',
            marginBottom: '8px',
          }}
        >
          <Send size={20} style={{ transform: 'rotate(-10deg) translateX(1px)' }} />
        </div>
        <h1 className="auth-page-heading" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.4px', margin: 0 }}>
          {mode === 'login'
            ? 'Sign In to AeroDrop'
            : 'Create an AeroDrop Account'}
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
          Secure sessions • Instant file transfers • Individual account isolation
        </p>
      </div>

      {/* Main Card */}
      <div
        className="auth-card"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* If currently signed in, show subtle banner with Go to App & Sign Out */}
        {isAuthenticated && currentUser && (
          <div
            className="auth-session-banner"
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.color || '#4f46e5',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  currentUser.initials || generateInitials(currentUser.displayName)
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', fontWeight: 600 }}>Currently Signed In</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.displayName} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '12px' }}>({currentUser.email})</span>
                </div>
              </div>
            </div>
            <div className="auth-session-actions" style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onNavigate?.('compose')}
                className="touch-target btn-press"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go to App
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  showToast?.({ type: 'info', title: 'Signed Out', message: 'You have been signed out.' });
                }}
                className="touch-target btn-press"
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-error)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div>
          {/* Tab Switcher: Sign In vs Create Account */}
          <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '3px',
                borderRadius: '10px',
                marginBottom: '14px',
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
                  padding: '7px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
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
                <LogIn size={14} />
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
                  padding: '7px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
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
                <UserPlus size={14} />
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
                    {displayName.trim() ? displayName : 'Your Public Profile Name'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                    Transfers and chat messages will be attributed to this unique verified profile.
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

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Display Name field (Registration only) */}
              {mode === 'register' && (
                <div>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                      marginBottom: '3px',
                    }}
                  >
                    Your Display Name *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 12px 0 38px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13px',
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
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'block',
                    marginBottom: '3px',
                  }}
                >
                  Email Address *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px 0 38px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 150ms ease',
                    }}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <label
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                    }}
                  >
                    Password *
                  </label>
                  {mode === 'register' && (
                    <span style={{ fontSize: '10.5px', color: 'var(--text-placeholder)' }}>
                      Min 8 characters
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Enter your account password' : 'Create a secure password'}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 36px 0 38px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
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

                {/* Password strength meter & live checklist (Registration only) */}
                {mode === 'register' && password.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-placeholder)' }}>Password Security</span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: strengthMeta.color,
                        }}
                      >
                        {strengthMeta.label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: strengthMeta.percent,
                          backgroundColor: strengthMeta.color,
                          transition: 'all 250ms ease',
                        }}
                      />
                    </div>

                    {/* Live Criteria Checklist */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px',
                        marginTop: '6px',
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isMinLength ? '#10b981' : 'var(--text-placeholder)' }}>
                        {isMinLength ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                        <span>8+ Characters</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: hasUpper ? '#10b981' : 'var(--text-placeholder)' }}>
                        {hasUpper ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                        <span>Uppercase letter</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: hasLower ? '#10b981' : 'var(--text-placeholder)' }}>
                        {hasLower ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                        <span>Lowercase letter</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: hasNumber ? '#10b981' : 'var(--text-placeholder)' }}>
                        {hasNumber ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                        <span>Number (0-9)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password field (Registration only) */}
              {mode === 'register' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <label
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'block',
                      }}
                    >
                      Confirm Password *
                    </label>
                    {passwordsMatch && (
                      <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={11} strokeWidth={3} /> Match
                      </span>
                    )}
                    {passwordMismatch && (
                      <span style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <X size={11} strokeWidth={3} /> Mismatch
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password to confirm"
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 36px 0 38px',
                        borderRadius: '10px',
                        border: passwordMismatch
                          ? '1px solid #ef4444'
                          : passwordsMatch
                          ? '1px solid #10b981'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13px',
                        outline: 'none',
                        transition: 'border-color 150ms ease',
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || (mode === 'register' && (!isStrongEnough || password !== confirmPassword))}
                className="touch-target btn-press"
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor:
                    mode === 'register' && (!isStrongEnough || password !== confirmPassword)
                      ? 'var(--bg-card-subtle)'
                      : 'var(--accent-primary)',
                  color:
                    mode === 'register' && (!isStrongEnough || password !== confirmPassword)
                      ? 'var(--text-placeholder)'
                      : '#ffffff',
                  border:
                    mode === 'register' && (!isStrongEnough || password !== confirmPassword)
                      ? '1px solid var(--border-subtle)'
                      : 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor:
                    loading || (mode === 'register' && (!isStrongEnough || password !== confirmPassword))
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                  boxShadow:
                    mode === 'register' && (!isStrongEnough || password !== confirmPassword)
                      ? 'none'
                      : 'var(--shadow-sm)',
                  transition: 'all 150ms ease',
                }}
              >
                {loading ? (
                  <span>Processing...</span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn size={16} />
                    <span>Sign In to Account</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Create Secure Account</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider: OR CONTINUE WITH */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                margin: '12px 0 10px 0',
                gap: '10px',
              }}
            >
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'var(--text-placeholder)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
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
                gap: '10px',
              }}
            >
              {/* Left Side: Google */}
              <button
                type="button"
                onClick={handleGoogleClick}
                className="touch-target btn-press"
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  padding: '0 8px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <GoogleIcon size={16} />
                <span>{mode === 'register' ? 'Google Sign-Up' : 'Google Sign-In'}</span>
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
                  height: '38px',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(79, 70, 229, 0.4)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  padding: '0 8px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <KeyRound size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Email OTP</span>
              </button>
            </div>

            {/* Bottom Security Assurance */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'var(--text-placeholder)',
                fontSize: '10px',
              }}
            >
              <ShieldCheck size={12} style={{ color: '#10b981' }} />
              <span>Salted bcrypt hashing • Isolated vaults • JWT session security</span>
            </div>
          </div>
        </div>

      {/* ======================================================================
          GOOGLE SIGN-IN MODAL (Account Chooser)
         ====================================================================== */}
      {showGoogleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
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

            {/* List of Detected Google Accounts from System/Browser */}
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
          EMAIL OTP VERIFICATION MODAL
         ====================================================================== */}
      {showOtpModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOtpModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              padding: '30px',
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
                top: '18px',
                right: '18px',
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
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}
            >
              <KeyRound size={22} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
              {otpSent ? 'Enter Verification Code' : 'Sign In with Email OTP'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              {otpSent
                ? `Enter the 6-digit code sent to ${otpEmailInput || email}`
                : 'Enter your email address to receive an instant 6-digit code.'}
            </p>

            {otpError && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{otpError}</span>
              </div>
            )}

            {otpSuccess && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '12.5px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'left',
                }}
              >
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{otpSuccess}</span>
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-placeholder)' }} />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={otpEmailInput}
                      onChange={(e) => setOtpEmailInput(e.target.value)}
                      placeholder="you@company.com"
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 14px 0 40px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '14px',
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
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14.5px',
                    fontWeight: 600,
                    cursor: otpLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {otpLoading ? <span>Sending Code...</span> : <span>Send 6-Digit Code</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    margin: '6px 0',
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
                        width: '44px',
                        height: '52px',
                        borderRadius: '12px',
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
                    height: '46px',
                    borderRadius: '12px',
                    backgroundColor:
                      otpDigits.join('').length === 6
                        ? 'var(--accent-primary)'
                        : 'var(--bg-card-subtle)',
                    color: otpDigits.join('').length === 6 ? '#ffffff' : 'var(--text-placeholder)',
                    border: 'none',
                    fontSize: '14.5px',
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
    </div>
  );
}
