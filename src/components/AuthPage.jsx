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
  ArrowLeft,
  ShieldCheck,
  Send,
  KeyRound,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { generateInitials } from '../utils/formatters';
import { verifyEmailDetailed } from '../utils/validators';
import InvalidEmailModal from './InvalidEmailModal';
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
  const {
    currentUser,
    login,
    register,
    logout,
    isAuthenticated,
    updateProfile,
    loginWithGoogle,
    sendOtp,
    verifyOtp,
    checkAvailability,
    sendPasswordResetCode,
    verifyPasswordResetCode,
    resetPassword,
  } = useAuth();

  // If user is already authenticated, immediately direct to compose page
  useEffect(() => {
    if (isAuthenticated) {
      onNavigate?.('compose');
    }
  }, [isAuthenticated, onNavigate]);

  // Mode: 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState(initialMode);

  // Form states
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

  // Uniqueness availability states (only active during registration)
  const [nameAvailability, setNameAvailability] = useState(null);
  const [emailAvailability, setEmailAvailability] = useState(null);

  // Google sign in states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState(() => getSavedGoogleAccounts());
  const [showManualGoogleInput, setShowManualGoogleInput] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Email OTP states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmailInput, setOtpEmailInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState(null);
  const [otpSuccess, setOtpSuccess] = useState('');
  const otpRefs = useRef([]);

  // Password Reset states
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeDigits, setResetCodeDigits] = useState(['', '', '', '', '', '']);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'verify'
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetCountdown, setResetCountdown] = useState(0);
  const resetOtpRefs = useRef([]);

  // General auth states
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-initialize Google Identity Services (GIS) on mount
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

  // Sync mode with props only when initialMode actually changes externally
  const prevInitialModeRef = useRef(initialMode);
  useEffect(() => {
    if (prevInitialModeRef.current !== initialMode) {
      prevInitialModeRef.current = initialMode;
      setMode(initialMode);
      setErrorInfo(null);
      setSuccessMsg('');
    }
  }, [initialMode]);

  // Countdown timer for OTP
  useEffect(() => {
    let t;
    if (otpCountdown > 0) {
      t = setInterval(() => setOtpCountdown((c) => Math.max(c - 1, 0)), 1000);
    }
    return () => clearInterval(t);
  }, [otpCountdown]);

  // Countdown timer for Password Reset
  useEffect(() => {
    let t;
    if (resetCountdown > 0) {
      t = setInterval(() => setResetCountdown((c) => Math.max(c - 1, 0)), 1000);
    }
    return () => clearInterval(t);
  }, [resetCountdown]);

  // Real-time email validation & uniqueness feedback
  useEffect(() => {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      setEmailValidation(null);
      setEmailAvailability(null);
      return;
    }
    if (trimmed.length >= 4) {
      const check = verifyEmailDetailed(trimmed);
      setEmailValidation(check);

      if (mode === 'register' && check.valid && checkAvailability) {
        const timer = setTimeout(async () => {
          try {
            const res = await checkAvailability({ email: trimmed });
            setEmailAvailability({ checked: true, available: res.emailAvailable });
          } catch (e) {}
        }, 350);
        return () => clearTimeout(timer);
      } else {
        setEmailAvailability(null);
      }
    } else {
      setEmailValidation(null);
      setEmailAvailability(null);
    }
  }, [email, mode]);

  // Real-time display name uniqueness check during registration
  useEffect(() => {
    const trimmed = (displayName || '').trim();
    if (!trimmed || mode !== 'register' || trimmed.length < 2) {
      setNameAvailability(null);
      return;
    }
    if (checkAvailability) {
      const timer = setTimeout(async () => {
        try {
          const res = await checkAvailability({ displayName: trimmed });
          setNameAvailability({ checked: true, available: res.nameAvailable });
        } catch (e) {}
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [displayName, mode]);

  // Real-time password criteria evaluation
  const isMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const strengthScore = [isMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrongEnough = strengthScore >= 4 && isMinLength;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Real-time password criteria evaluation for Reset Password
  const resetMinLength = resetNewPassword.length >= 8;
  const resetHasUpper = /[A-Z]/.test(resetNewPassword);
  const resetHasLower = /[a-z]/.test(resetNewPassword);
  const resetHasNumber = /[0-9]/.test(resetNewPassword);
  const resetHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(resetNewPassword);
  const resetStrengthScore = [resetMinLength, resetHasUpper, resetHasLower, resetHasNumber, resetHasSpecial].filter(Boolean).length;
  const isResetStrongEnough = resetStrengthScore >= 4 && resetMinLength;

  const resetPasswordsMatch = resetConfirmPassword.length > 0 && resetNewPassword === resetConfirmPassword;
  const resetPasswordMismatch = resetConfirmPassword.length > 0 && resetNewPassword !== resetConfirmPassword;

  const getStrengthMeta = () => {
    if (strengthScore <= 1) return { label: 'Very Weak', color: '#ef4444', percent: '20%' };
    if (strengthScore === 2) return { label: 'Weak', color: '#f97316', percent: '40%' };
    if (strengthScore === 3) return { label: 'Moderate', color: '#eab308', percent: '65%' };
    if (strengthScore === 4) return { label: 'Strong', color: '#3b82f6', percent: '85%' };
    return { label: 'Very Strong', color: '#10b981', percent: '100%' };
  };

  const getResetStrengthMeta = () => {
    if (resetStrengthScore <= 1) return { label: 'Very Weak', color: '#ef4444', percent: '20%' };
    if (resetStrengthScore === 2) return { label: 'Weak', color: '#f97316', percent: '40%' };
    if (resetStrengthScore === 3) return { label: 'Moderate', color: '#eab308', percent: '65%' };
    if (resetStrengthScore === 4) return { label: 'Strong', color: '#3b82f6', percent: '85%' };
    return { label: 'Very Strong', color: '#10b981', percent: '100%' };
  };

  const strengthMeta = getStrengthMeta();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMsg('');

    // Strict Email Validity Check
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
        showToast?.({
          type: 'success',
          title: 'Welcome Back!',
          message: `Logged in as ${user.displayName}`,
        });
        onNavigate?.('compose');
      } else {
        const user = await register(email, password, displayName);
        setSuccessMsg(`Account created for ${user.displayName}!`);
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

  // OTP handlers
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

  // Password Reset handlers
  const handleResetOtpChange = (index, val) => {
    if (val.length > 1) {
      const nums = val.replace(/\D/g, '').slice(0, 6).split('');
      const copy = [...resetCodeDigits];
      nums.forEach((n, i) => { if (i < 6) copy[i] = n; });
      setResetCodeDigits(copy);
      const nextIdx = Math.min(nums.length, 5);
      resetOtpRefs.current[nextIdx]?.focus();
      return;
    }
    const clean = val.replace(/\D/g, '');
    const copy = [...resetCodeDigits];
    copy[index] = clean;
    setResetCodeDigits(copy);
    if (clean && index < 5) resetOtpRefs.current[index + 1]?.focus();
  };

  const handleResetOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !resetCodeDigits[index] && index > 0) {
      resetOtpRefs.current[index - 1]?.focus();
    }
  };

  const handleRequestResetCode = async (e) => {
    e?.preventDefault();
    setResetError(null);
    setResetSuccess('');
    const target = (resetEmail || email).trim().toLowerCase();
    if (!target) {
      setResetError('Please enter your email address to receive a verification code.');
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
      setResetError(check.reason);
      return;
    }

    setResetLoading(true);
    try {
      const res = await sendPasswordResetCode(target);
      setResetEmail(target);
      setResetStep('verify');
      setResetCountdown(60);
      setResetSuccess(res.message || `A 6-digit verification code has been dispatched to ${target}.`);
      showToast?.({
        type: 'success',
        title: 'Reset Code Dispatched',
        message: `6-digit reset code sent to ${target}`,
      });
      setTimeout(() => resetOtpRefs.current[0]?.focus(), 150);
    } catch (err) {
      setResetError(err.message || 'Failed to dispatch password reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCompletePasswordReset = async (e) => {
    e?.preventDefault();
    setResetError(null);
    setResetSuccess('');
    const code = resetCodeDigits.join('').trim();
    if (code.length !== 6) {
      setResetError('Please enter all 6 digits of your verification code.');
      return;
    }
    if (!isResetStrongEnough) {
      setResetError('Please choose a stronger password matching the security criteria.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setResetLoading(true);
    try {
      const target = (resetEmail || email).trim().toLowerCase();
      const res = await resetPassword(target, code, resetNewPassword);
      setResetSuccess('Password reset successfully! Logging you in...');
      showToast?.({
        type: 'success',
        title: 'Password Reset Successful!',
        message: `Welcome back, ${res.user?.displayName || 'User'}!`,
      });
      setTimeout(() => {
        onNavigate?.('compose');
      }, 500);
    } catch (err) {
      setResetError(err.message || 'Failed to reset password. Please check the code and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resetCountdown > 0 || resetLoading) return;
    setResetError(null);
    const target = (resetEmail || email).trim().toLowerCase();
    setResetLoading(true);
    try {
      await sendPasswordResetCode(target);
      setResetCountdown(60);
      setResetSuccess(`A new 6-digit verification code has been dispatched to ${target}.`);
      showToast?.({
        type: 'info',
        title: 'New Code Sent',
        message: `New code sent to ${target}`,
      });
    } catch (err) {
      setResetError(err.message || 'Failed to resend code.');
    } finally {
      setResetLoading(false);
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

  return (
    <div
      className="animate-fade-up auth-page-wrapper"
      style={{
        width: '100%',
        maxWidth: '440px',
        margin: 'auto auto',
        padding: '0 8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand Header */}
      <div className="auth-heading-block" style={{ textAlign: 'center', marginBottom: '18px', flexShrink: 0 }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: mode === 'forgot'
              ? 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
              : mode === 'register'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px var(--accent-glow)',
            marginBottom: '10px',
            transition: 'all 250ms ease',
          }}
        >
          {mode === 'forgot' ? (
            <KeyRound size={22} />
          ) : mode === 'register' ? (
            <UserPlus size={22} />
          ) : (
            <Send size={22} style={{ transform: 'rotate(-10deg) translateX(1px)' }} />
          )}
        </div>
        <h1 className="auth-page-heading" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.4px', margin: 0 }}>
          {mode === 'login'
            ? 'Sign In to AeroDrop'
            : mode === 'register'
            ? 'Create an AeroDrop Account'
            : resetStep === 'verify'
            ? 'Set New Password'
            : 'Reset Your Password'}
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '5px', maxWidth: '360px', margin: '5px auto 0 auto', lineHeight: 1.45 }}>
          {mode === 'login'
            ? 'Secure sessions • Instant file transfers • Isolated vaults'
            : mode === 'register'
            ? 'Join AeroDrop for instant verified email transfers & group chat'
            : resetStep === 'verify'
            ? `Enter the 6-digit code sent to ${resetEmail || email} and choose a new password`
            : 'Enter your registered email to receive a secure 6-digit reset code'}
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
          padding: '24px 24px 20px',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {mode === 'forgot' ? (
          <div>
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetStep('request');
                  setResetError(null);
                  setResetSuccess('');
                  setErrorInfo(null);
                  onNavigate?.('login');
                }}
                className="touch-target btn-press"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <ArrowLeft size={14} />
                <span>Back to Sign In</span>
              </button>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-subtle)',
                  padding: '3px 8px',
                  borderRadius: '999px',
                }}
              >
                {resetStep === 'request' ? 'Step 1 of 2' : 'Step 2 of 2'}
              </span>
            </div>

            {/* Error & Success Feedback */}
            {resetError && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.4,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{resetSuccess}</span>
              </div>
            )}

            {resetStep === 'request' ? (
              /* Step 1: Request OTP by entering Email */
              <form onSubmit={handleRequestResetCode} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Registered Email Address *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={resetEmail || email}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setEmail(e.target.value);
                      }}
                      placeholder="you@company.com"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 14px 0 38px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-placeholder)', marginTop: '6px', lineHeight: 1.4 }}>
                    We'll email you a 6-digit verification code to securely reset your password.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="touch-target btn-press"
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)',
                    marginTop: '4px',
                  }}
                >
                  {resetLoading ? (
                    <span>Sending Code...</span>
                  ) : (
                    <>
                      <span>Send 6-Digit Code</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Step 2: Enter 6-digit OTP code & new password */
              <form onSubmit={handleCompletePasswordReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      6-Digit Reset Code *
                    </label>
                    <button
                      type="button"
                      disabled={resetCountdown > 0 || resetLoading}
                      onClick={handleResendResetCode}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: resetCountdown > 0 ? 'var(--text-placeholder)' : 'var(--accent-primary)',
                        cursor: resetCountdown > 0 ? 'default' : 'pointer',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <RotateCcw size={11} />
                      <span>{resetCountdown > 0 ? `Resend in ${resetCountdown}s` : 'Resend Code'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                    {resetCodeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (resetOtpRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleResetOtpKeyDown(idx, e)}
                        style={{
                          width: '100%',
                          height: '46px',
                          borderRadius: '10px',
                          border: digit ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-main)',
                          textAlign: 'center',
                          fontSize: '18px',
                          fontWeight: 700,
                          outline: 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* New Password field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      New Password *
                    </label>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-placeholder)' }}>
                      Min 8 characters
                    </span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type={showResetNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Enter new secure password"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 38px 0 38px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword((p) => !p)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-placeholder)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      {showResetNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password strength bar & checklist */}
                  {resetNewPassword.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-placeholder)' }}>Password Security</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: getResetStrengthMeta().color }}>
                          {getResetStrengthMeta().label}
                        </span>
                      </div>
                      <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: getResetStrengthMeta().percent, backgroundColor: getResetStrengthMeta().color, transition: 'all 200ms ease' }} />
                      </div>
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
                          fontSize: '10.5px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: resetMinLength ? '#10b981' : 'var(--text-placeholder)' }}>
                          {resetMinLength ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                          <span>8+ Characters</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: resetHasUpper ? '#10b981' : 'var(--text-placeholder)' }}>
                          {resetHasUpper ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                          <span>Uppercase letter</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: resetHasLower ? '#10b981' : 'var(--text-placeholder)' }}>
                          {resetHasLower ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                          <span>Lowercase letter</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: resetHasNumber ? '#10b981' : 'var(--text-placeholder)' }}>
                          {resetHasNumber ? <Check size={11} strokeWidth={3} /> : <span>•</span>}
                          <span>Number (0-9)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm New Password field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Confirm New Password *
                    </label>
                    {resetPasswordsMatch && (
                      <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Check size={11} strokeWidth={3} /> Match
                      </span>
                    )}
                    {resetPasswordMismatch && (
                      <span style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <X size={11} strokeWidth={3} /> Mismatch
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-placeholder)' }} />
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      required
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password to confirm"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 38px 0 38px',
                        borderRadius: '10px',
                        border: resetPasswordMismatch
                          ? '1px solid #ef4444'
                          : resetPasswordsMatch
                          ? '1px solid #10b981'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword((p) => !p)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-placeholder)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      {showResetConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading || !isResetStrongEnough || resetNewPassword !== resetConfirmPassword || resetCodeDigits.join('').trim().length !== 6}
                  className="touch-target btn-press"
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: (!isResetStrongEnough || resetNewPassword !== resetConfirmPassword || resetCodeDigits.join('').trim().length !== 6)
                      ? 'var(--bg-card-subtle)'
                      : 'var(--accent-primary)',
                    color: (!isResetStrongEnough || resetNewPassword !== resetConfirmPassword || resetCodeDigits.join('').trim().length !== 6)
                      ? 'var(--text-placeholder)'
                      : '#ffffff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: (!isResetStrongEnough || resetNewPassword !== resetConfirmPassword || resetCodeDigits.join('').trim().length !== 6 || resetLoading)
                      ? 'not-allowed'
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)',
                    marginTop: '4px',
                  }}
                >
                  {resetLoading ? <span>Updating Password...</span> : <span>Reset Password & Sign In</span>}
                </button>
              </form>
            )}

            {/* Bottom Security Assurance for Forgot */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'var(--text-placeholder)',
                fontSize: '10.5px',
              }}
            >
              <ShieldCheck size={12} style={{ color: '#10b981' }} />
              <span>Encrypted tokens • Instant revocation • Verified reset</span>
            </div>
          </div>
        ) : (
          <div>
            {/* Tab Switcher: Sign In vs Create Account */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '3px',
                borderRadius: '10px',
                marginBottom: '16px',
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
                  padding: '8px 12px',
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
                  padding: '8px 12px',
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
                  gap: '12px',
                  marginBottom: '18px',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '16px',
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
                  <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', lineHeight: 1.35 }}>
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
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#10b98118',
                  color: '#10b981',
                  border: '1px solid #10b98135',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '16px',
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
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                      {errorInfo.message}
                    </div>

                    {/* 1-click switch to Log In */}
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

                    {/* 1-click switch to Sign Up */}
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
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Display Name field (Registration only) */}
              {mode === 'register' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'block',
                      }}
                    >
                      Your Account Name *
                    </label>
                    {nameAvailability?.checked && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: nameAvailability.available ? '#10B981' : '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {nameAvailability.available ? '✓ Available' : '⚠ Name taken'}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        color: nameAvailability?.checked
                          ? nameAvailability.available
                            ? '#10B981'
                            : '#EF4444'
                          : 'var(--text-placeholder)',
                      }}
                    />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 12px 0 38px',
                        borderRadius: '10px',
                        border: nameAvailability?.checked
                          ? nameAvailability.available
                            ? '1.5px solid #10B981'
                            : '1.5px solid #EF4444'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 150ms ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Email Address field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                    }}
                  >
                    Email Address *
                  </label>
                  {emailValidation && (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: !emailValidation.valid
                          ? '#EF4444'
                          : emailAvailability?.checked && !emailAvailability.available
                          ? '#F59E0B'
                          : '#10B981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {!emailValidation.valid
                        ? '⚠ Invalid email'
                        : emailAvailability?.checked && !emailAvailability.available
                        ? '⚠ Account exists'
                        : '✓ Valid email'}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      color: emailValidation
                        ? !emailValidation.valid
                          ? '#EF4444'
                          : emailAvailability?.checked && !emailAvailability.available
                          ? '#F59E0B'
                          : '#10B981'
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
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '10px',
                      border: emailValidation
                        ? !emailValidation.valid
                          ? '1.5px solid #EF4444'
                          : emailAvailability?.checked && !emailAvailability.available
                          ? '1.5px solid #F59E0B'
                          : '1.5px solid #10B981'
                        : '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 150ms ease',
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
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#EF4444', fontWeight: 500 }}>
                    {emailValidation.reason}
                  </div>
                )}
              </div>

              {/* Password field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'block',
                    }}
                  >
                    Password *
                  </label>
                  {mode === 'login' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setResetStep('request');
                        setResetEmail(email.trim());
                        setResetError(null);
                        setResetSuccess('');
                        setErrorInfo(null);
                        onNavigate?.('forgot');
                      }}
                      className="touch-target"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 0',
                        transition: 'opacity 150ms ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      Forgot password?
                    </button>
                  ) : (
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
                      height: '42px',
                      padding: '0 36px 0 38px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
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
                        fontSize: '10.5px',
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label
                      style={{
                        fontSize: '11.5px',
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
                        height: '42px',
                        padding: '0 36px 0 38px',
                        borderRadius: '10px',
                        border: passwordMismatch
                          ? '1px solid #ef4444'
                          : passwordsMatch
                          ? '1px solid #10b981'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
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
                  height: '44px',
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

            {/* Alternate Sign-In Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 10px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '10.5px', color: 'var(--text-placeholder)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                or continue with
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            </div>

            {/* Quick Sign-In Options */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={loading || googleLoading}
                className="touch-target btn-press"
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 150ms ease',
                }}
              >
                <GoogleIcon size={15} />
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpEmailInput(email.trim());
                  setShowOtpModal(true);
                }}
                disabled={loading}
                className="touch-target btn-press"
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 150ms ease',
                }}
              >
                <KeyRound size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Email OTP</span>
              </button>
            </div>

            {/* Bottom Security Assurance */}
            <div
              style={{
                marginTop: '14px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'var(--text-placeholder)',
                fontSize: '10.5px',
              }}
            >
              <ShieldCheck size={12} style={{ color: '#10b981' }} />
              <span>Salted bcrypt hashing • Isolated vaults • JWT session security</span>
            </div>
          </div>
        )}
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
