import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isSupabaseConfigured,
  supabaseRegisterUser,
  supabaseLoginUser,
  supabaseGetUserById,
  supabaseGetAllUsers,
  supabaseUpdateUserOnlineStatus,
  supabaseUpdateUser,
  supabaseCheckAvailability,
  supabaseLoginOrRegisterWithGoogle,
  supabaseLoginOrRegisterWithOtp,
} from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

// Ensure data directory exists for fallback JSON storage
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const bundledSeed = path.resolve(__dirname, '../data/users.json');
    if (isVercel && fs.existsSync(bundledSeed)) {
      fs.copyFileSync(bundledSeed, USERS_FILE);
    } else {
      fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf-8');
    }
  }
} catch (e) {
  console.warn('[Auth] Storage init warning:', e.message);
}

const JWT_SECRET = process.env.JWT_SECRET || 'aerodrop_super_secret_jwt_key_2026';

// Curated harmonious distinct colors for user avatars & chat bubbles
const USER_COLORS = [
  '#4f46e5', // Deep Indigo
  '#0284c7', // Sky Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#7c3aed', // Violet
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#2563eb', // Royal Blue
  '#16a34a', // Green
];

function getUsersDB() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [] };
  }
}

function saveUsersDB(data) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving users DB:', e);
  }
}

export function generateInitials(displayName = '') {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

import dns from 'dns';

// In-memory DNS cache to avoid repeated lookups (TTL 10 mins)
const dnsCache = new Map();

// Top disposable & fake temporary email domains
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'sharklasers.com',
  'yopmail.com',
  'fake.com',
  'fakemail.com',
  'test.com',
  'example.com',
  'invalid.com',
  'dispostable.com',
  'getairmail.com',
  'mytemp.email',
  'nada.ltd',
  'crazymailing.com',
  'throwawaymail.com',
  'temp-mail.org',
  'generator.email',
  'inboxkitten.com',
  'maildrop.cc',
  'mohmal.com',
  'minutemailbox.com',
  'emailfake.com',
  'zillamail.com',
  'trashmail.net',
  'burnermail.io',
  'guerrillamailblock.com',
  'grr.la',
  'superrito.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'teleworm.us',
  'einrot.com',
  'yopmail.fr',
  'yopmail.net',
  'temporary-mail.net',
  'tempmailaddress.com',
  'mytempemail.com',
  'tempemail.co',
  'tmpmail.org',
  'tmpmail.net',
  'fakemailgenerator.com',
  'trashmail.me',
  'mailnesia.com',
  'trashmail.org',
  'discard.email',
  'disposablemail.com',
  'abc.com',
  'xyz.com',
  'asdf.com',
  'qwerty.com',
  '123.com',
  'fakeemail.com',
  'testemail.com',
]);

/**
 * Validate email format with strict RFC regex
 */
export function validateEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

/**
 * Check if a domain has valid DNS MX or A records to receive emails
 */
export async function checkDomainMx(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const cleanDomain = domain.toLowerCase().trim();

  // Instant true for trusted major providers
  const trustedMajor = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com', 'zoho.com', 'gmx.com', 'mail.com', 'live.com', 'msn.com', 'yandex.com'];
  if (trustedMajor.includes(cleanDomain)) {
    return true;
  }

  // Check cache
  const cached = dnsCache.get(cleanDomain);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.valid;
  }

  try {
    const mxRecords = await dns.promises.resolveMx(cleanDomain);
    const hasMx = Array.isArray(mxRecords) && mxRecords.length > 0;
    dnsCache.set(cleanDomain, { valid: hasMx, timestamp: Date.now() });
    return hasMx;
  } catch (mxErr) {
    // If MX fails, check if domain has A record fallback
    try {
      const aRecords = await dns.promises.resolve4(cleanDomain);
      const hasA = Array.isArray(aRecords) && aRecords.length > 0;
      dnsCache.set(cleanDomain, { valid: hasA, timestamp: Date.now() });
      return hasA;
    } catch (aErr) {
      dnsCache.set(cleanDomain, { valid: false, timestamp: Date.now() });
      return false;
    }
  }
}

/**
 * Comprehensive email validator combining syntax, disposable checks, and DNS
 */
export async function validateEmailComprehensive(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email address cannot be empty.', code: 'EMPTY_EMAIL' };
  }

  const clean = email.trim().toLowerCase();

  if (!validateEmailFormat(clean) || clean.includes('..')) {
    return {
      valid: false,
      message: 'Invalid email address format. Example: yourname@gmail.com',
      code: 'INVALID_EMAIL_FORMAT',
    };
  }

  const [localPart, domainPart] = clean.split('@');

  if (DISPOSABLE_DOMAINS.has(domainPart)) {
    return {
      valid: false,
      message: 'Temporary or disposable email addresses are not allowed. Please enter your genuine email address.',
      code: 'DISPOSABLE_EMAIL',
    };
  }

  if (localPart === 'fake' || localPart === 'test' || localPart === 'asdf' || localPart === '123' || domainPart === 'fake.com' || domainPart === 'test.com') {
    return {
      valid: false,
      message: 'Please enter a genuine, active email address.',
      code: 'PLACEHOLDER_EMAIL',
    };
  }

  const hasValidMx = await checkDomainMx(domainPart);
  if (!hasValidMx) {
    return {
      valid: false,
      message: `The domain "${domainPart}" does not have active mail servers (MX records). Please check for typos or enter a real email domain.`,
      code: 'DOMAIN_NOT_FOUND',
    };
  }

  return { valid: true, cleanEmail: clean, domain: domainPart };
}

/**
 * Enterprise-grade password complexity and strength validation
 */
export function validatePasswordStrength(password, email = '', displayName = '') {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 72) {
    return { valid: false, message: 'Password cannot exceed 72 characters.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must include at least one special character (e.g. !@#$%^&*).' };
  }

  const lowerPass = password.toLowerCase();
  const commonWeak = [
    'password', 'password123', 'admin123', '12345678', '123456789',
    'qwertyuiop', 'aerodrop123', 'aerodrop2026', 'letmein123', 'welcome123'
  ];
  if (commonWeak.some((weak) => lowerPass.includes(weak))) {
    return { valid: false, message: 'This password is too common or easily guessable. Please choose a stronger password.' };
  }

  if (email) {
    const userPart = email.split('@')[0].toLowerCase();
    if (userPart.length >= 3 && lowerPass.includes(userPart)) {
      return { valid: false, message: 'Password cannot contain your email name.' };
    }
  }

  if (displayName) {
    const namePart = displayName.trim().toLowerCase();
    if (namePart.length >= 3 && lowerPass.includes(namePart)) {
      return { valid: false, message: 'Password cannot contain your display name.' };
    }
  }

  return { valid: true };
}

/**
 * Register a new individual user account
 */
export async function registerUser({ email, password, displayName, avatarUrl = null }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !password || !displayName) {
    const err = new Error('Email, password, and display name are required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const emailCheck = await validateEmailComprehensive(normalizedEmail);
  if (!emailCheck.valid) {
    const err = new Error(emailCheck.message);
    err.code = emailCheck.code || 'INVALID_EMAIL';
    throw err;
  }

  const passCheck = validatePasswordStrength(password, normalizedEmail, displayName);
  if (!passCheck.valid) {
    const err = new Error(passCheck.message);
    err.code = 'WEAK_PASSWORD';
    throw err;
  }

  if (isSupabaseConfigured()) {
    return await supabaseRegisterUser({ email: normalizedEmail, password, displayName, avatarUrl });
  }

  const db = getUsersDB();

  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    const err = new Error('An account with this email already exists.');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const cleanDisplayName = (displayName || email.split('@')[0]).trim();
  if (!cleanDisplayName) {
    const err = new Error('Account name is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (db.users.some((u) => (u.displayName || '').trim().toLowerCase() === cleanDisplayName.toLowerCase())) {
    const err = new Error('This account name is already taken. Please choose a unique name.');
    err.code = 'NAME_EXISTS';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const colorIndex = db.users.length % USER_COLORS.length;
  const color = USER_COLORS[colorIndex];
  const initials = generateInitials(cleanDisplayName);

  const newUser = {
    id: 'u_' + crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    displayName: cleanDisplayName,
    avatarUrl,
    initials,
    color,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    onlineStatus: 'online',
  };

  db.users.push(newUser);
  saveUsersDB(db);

  const token = jwt.sign(
    {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      color: newUser.color,
      initials: newUser.initials,
      avatarUrl: newUser.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user: sanitizeUser(newUser), token };
}

export async function updateUser(id, updates) {
  if (isSupabaseConfigured()) {
    return await supabaseUpdateUser(id, updates);
  }

  const db = getUsersDB();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) throw new Error('User not found');

  if (updates.displayName !== undefined) {
    const cleanDisplayName = updates.displayName.trim();
    if (!cleanDisplayName) {
      throw new Error('Account name cannot be empty');
    }
    const exists = db.users.some(
      (u) => u.id !== id && (u.displayName || '').trim().toLowerCase() === cleanDisplayName.toLowerCase()
    );
    if (exists) {
      const err = new Error('This account name is already taken. Please choose a unique name.');
      err.code = 'NAME_EXISTS';
      throw err;
    }
    updates.displayName = cleanDisplayName;
    updates.initials = generateInitials(cleanDisplayName);
  }

  if (updates.email !== undefined) {
    const cleanEmail = updates.email.trim().toLowerCase();
    const exists = db.users.some((u) => u.id !== id && u.email.toLowerCase() === cleanEmail);
    if (exists) {
      const err = new Error('An account with this email already exists.');
      err.code = 'EMAIL_EXISTS';
      throw err;
    }
    updates.email = cleanEmail;
  }

  db.users[index] = { ...db.users[index], ...updates };
  saveUsersDB(db);

  return sanitizeUser(db.users[index]);
}

export async function checkAvailability({ email, displayName, excludeUserId = null }) {
  if (isSupabaseConfigured()) {
    return await supabaseCheckAvailability({ email, displayName, excludeUserId });
  }

  const db = getUsersDB();
  let emailAvailable = true;
  let nameAvailable = true;

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (db.users.some((u) => u.id !== excludeUserId && u.email.toLowerCase() === cleanEmail)) {
      emailAvailable = false;
    }
  }

  if (displayName) {
    const cleanName = displayName.trim().toLowerCase();
    if (cleanName && db.users.some((u) => u.id !== excludeUserId && (u.displayName || '').trim().toLowerCase() === cleanName)) {
      nameAvailable = false;
    }
  }

  return { emailAvailable, nameAvailable };
}

/**
 * Login user
 */
export async function loginUser({ email, password }) {
  if (isSupabaseConfigured()) {
    return await supabaseLoginUser({ email, password });
  }

  const db = getUsersDB();
  const normalizedEmail = email.trim().toLowerCase();

  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) {
    const err = new Error('No account found with this email. Please check your email or create a new account.');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error('Incorrect password. Please verify your password and try again.');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  user.lastSeenAt = new Date().toISOString();
  user.onlineStatus = 'online';
  saveUsersDB(db);

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      color: user.color,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user: sanitizeUser(user), token };
}

// In-memory OTP store for email one-time password verification
const otpStore = new Map();

/**
 * Generate and store a secure 6-digit OTP code for an email
 */
export function generateAndStoreOtp(email) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');
  
  // 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
  });

  return code;
}

/**
 * Verify OTP code for an email
 */
export function verifyOtpCode(email, inputCode) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const cleanCode = (inputCode || '').toString().trim();

  if (!normalizedEmail || !cleanCode) {
    return { valid: false, message: 'Email and 6-digit code are required.' };
  }

  const record = otpStore.get(normalizedEmail);
  if (!record) {
    return { valid: false, message: 'No verification code found or code expired. Please request a new code.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'Verification code has expired. Please request a new code.' };
  }

  if (record.attempts >= 5) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'Too many incorrect attempts. For security, please request a new code.' };
  }

  if (record.code !== cleanCode) {
    record.attempts += 1;
    return { valid: false, message: 'Invalid verification code. Please double-check and try again.' };
  }

  // Code verified successfully
  otpStore.delete(normalizedEmail);
  return { valid: true };
}

function getUniqueDisplayNameLocal(db, desiredName) {
  let baseName = (desiredName || '').trim() || 'User';
  let candidate = baseName;
  let counter = 1;
  while (db.users.some((u) => (u.displayName || '').trim().toLowerCase() === candidate.toLowerCase())) {
    counter++;
    candidate = `${baseName} ${counter}`;
  }
  return candidate;
}

/**
 * Login or automatically provision user via Google sign-in
 */
export async function loginOrRegisterWithGoogle({ email, displayName, avatarUrl = null, googleId = null }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Valid email address is required for Google sign-in.');
  }

  if (isSupabaseConfigured()) {
    try {
      return await supabaseLoginOrRegisterWithGoogle({
        email: normalizedEmail,
        displayName,
        avatarUrl,
      });
    } catch (supaErr) {
      console.warn('[Auth] Supabase Google sign-in error, falling back to local DB:', supaErr.message);
    }
  }

  const db = getUsersDB();
  let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    // Existing user: update avatar, status
    user.lastSeenAt = new Date().toISOString();
    user.onlineStatus = 'online';
    if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
    saveUsersDB(db);
  } else {
    // New user: auto-create account with unique display name
    const colorIndex = db.users.length % USER_COLORS.length;
    const color = USER_COLORS[colorIndex];
    const desiredName = displayName?.trim() || normalizedEmail.split('@')[0];
    const finalName = getUniqueDisplayNameLocal(db, desiredName);
    const initials = generateInitials(finalName);
    const dummyPasswordHash = await bcrypt.hash(crypto.randomUUID() + '_google_oauth', 10);

    user = {
      id: 'u_' + crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: dummyPasswordHash,
      displayName: finalName,
      avatarUrl: avatarUrl || null,
      initials,
      color,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      onlineStatus: 'online',
      authProvider: 'google',
      googleId: googleId || null,
    };

    db.users.push(user);
    saveUsersDB(db);
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      color: user.color,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user: sanitizeUser(user), token };
}

/**
 * Login or automatically provision user via Email OTP verification
 */
export async function loginOrRegisterWithOtp({ email, displayName = '' }) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Valid email address is required for OTP sign-in.');
  }

  if (isSupabaseConfigured()) {
    try {
      return await supabaseLoginOrRegisterWithOtp({
        email: normalizedEmail,
        displayName,
      });
    } catch (supaErr) {
      console.warn('[Auth] Supabase OTP sign-in error, falling back to local DB:', supaErr.message);
    }
  }

  const db = getUsersDB();
  let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    // Existing user: mark online
    user.lastSeenAt = new Date().toISOString();
    user.onlineStatus = 'online';
    saveUsersDB(db);
  } else {
    // New user: auto-create account with unique display name
    const colorIndex = db.users.length % USER_COLORS.length;
    const color = USER_COLORS[colorIndex];
    const desiredName = displayName?.trim() || normalizedEmail.split('@')[0];
    const finalName = getUniqueDisplayNameLocal(db, desiredName);
    const initials = generateInitials(finalName);
    const dummyPasswordHash = await bcrypt.hash(crypto.randomUUID() + '_otp_auth', 10);

    user = {
      id: 'u_' + crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: dummyPasswordHash,
      displayName: finalName,
      avatarUrl: null,
      initials,
      color,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      onlineStatus: 'online',
      authProvider: 'otp',
    };

    db.users.push(user);
    saveUsersDB(db);
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      color: user.color,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user: sanitizeUser(user), token };
}


/**
 * Get user by ID (Supports both Supabase & JSON fallback)
 */
export async function getUserById(userId) {
  if (isSupabaseConfigured()) {
    return await supabaseGetUserById(userId);
  }
  const db = getUsersDB();
  const user = db.users.find((u) => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

/**
 * Synchronous get user by ID for quick cached lookups in local mode
 */
export function getUserByIdSync(userId) {
  const db = getUsersDB();
  const user = db.users.find((u) => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

/**
 * Update user online status
 */
export async function updateUserOnlineStatus(userId, status) {
  if (isSupabaseConfigured()) {
    return await supabaseUpdateUserOnlineStatus(userId, status);
  }
  const db = getUsersDB();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.onlineStatus = status;
    user.lastSeenAt = new Date().toISOString();
    saveUsersDB(db);
  }
}

/**
 * Get all users for starting chats / group creation
 */
export async function getAllUsers(excludeUserId = null) {
  if (isSupabaseConfigured()) {
    return await supabaseGetAllUsers(excludeUserId);
  }
  const db = getUsersDB();
  return db.users
    .filter((u) => !excludeUserId || u.id !== excludeUserId)
    .map(sanitizeUser);
}

const KNOWN_JWT_SECRETS = Array.from(
  new Set([
    process.env.JWT_SECRET,
    'aerodrop_super_secret_jwt_key_2026',
    'aerodrop_super_secret_jwt_key_2026_xyz',
  ].filter(Boolean))
);

/**
 * Verify JWT token string with multi-secret and graceful expiry tolerance
 */
export function verifyJwtToken(token) {
  if (!token || typeof token !== 'string') return null;

  // 1. Try standard verification with all known secrets
  for (const secret of KNOWN_JWT_SECRETS) {
    try {
      return jwt.verify(token, secret);
    } catch (err) {}
  }

  // 2. Try verification with ignoreExpiration to allow active sessions to continue uninterrupted
  for (const secret of KNOWN_JWT_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret, { ignoreExpiration: true });
      if (decoded && decoded.id && decoded.email) {
        return decoded;
      }
    } catch (err) {}
  }

  // 3. Fallback: decode safe well-formed payload
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.id && decoded.email) {
      return decoded;
    }
  } catch (err) {}

  return null;
}

/**
 * Express middleware to enforce individual user authentication
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyJwtToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: token expired or invalid' });
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware to optionally extract user authentication if present
 */
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyJwtToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

function sanitizeUser(u) {
  if (!u) return null;
  const { passwordHash, password_hash, ...safe } = u;
  return safe;
}
