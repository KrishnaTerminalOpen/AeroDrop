import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(__dirname, '../data');
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

// Ensure data directory exists
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

const JWT_SECRET = process.env.JWT_SECRET || 'aerodrop_super_secret_jwt_key_2026_xyz';

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

/**
 * Register a new individual user account
 */
export async function registerUser({ email, password, displayName, avatarUrl = null }) {
  const db = getUsersDB();
  const normalizedEmail = email.trim().toLowerCase();

  if (db.users.some((u) => u.email === normalizedEmail)) {
    const err = new Error('An account with this email already exists.');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Assign deterministic or random distinct color
  const colorIndex = db.users.length % USER_COLORS.length;
  const color = USER_COLORS[colorIndex];
  const initials = generateInitials(displayName || email.split('@')[0]);

  const newUser = {
    id: 'u_' + crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    displayName: displayName.trim() || email.split('@')[0],
    avatarUrl,
    initials,
    color,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    onlineStatus: 'online',
  };

  db.users.push(newUser);
  saveUsersDB(db);

  // Generate 7-day JWT token
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

/**
 * Login user
 */
export async function loginUser({ email, password }) {
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

/**
 * Get user by ID
 */
export function getUserById(userId) {
  const db = getUsersDB();
  const user = db.users.find((u) => u.id === userId);
  return user ? sanitizeUser(user) : null;
}

/**
 * Update user online status
 */
export function updateUserOnlineStatus(userId, status) {
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
export function getAllUsers(excludeUserId = null) {
  const db = getUsersDB();
  return db.users
    .filter((u) => !excludeUserId || u.id !== excludeUserId)
    .map(sanitizeUser);
}

/**
 * Verify JWT token string
 */
export function verifyJwtToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
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

function sanitizeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}
