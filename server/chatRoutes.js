import express from 'express';
import {
  registerUser,
  loginUser,
  getAllUsers,
  authMiddleware,
  getUserById,
  validatePasswordStrength,
  validateEmailFormat,
  validateEmailComprehensive,
  updateUser,
  generateAndStoreOtp,
  verifyOtpCode,
  loginOrRegisterWithGoogle,
  loginOrRegisterWithOtp,
} from './auth.js';
import { sendOtpEmail } from './emailService.js';
import {
  getUserRooms,
  getRoomById,
  getOrCreateDirectRoom,
  createGroupRoom,
  getRoomMessages,
  addMemberToRoom,
  removeMemberFromRoom,
  markRoomMessagesAsRead,
  getEnrichedRoom,
  createMessage,
} from './chatStorage.js';
import { notifyRoomCreated, broadcastNewMessage } from './socketServer.js';
import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogin,
} from './rateLimiter.js';

const router = express.Router();

/**
 * AUTHENTICATION ENDPOINTS
 */

/**
 * Validate email address format, disposable status, and DNS MX records
 */
router.post('/auth/validate-email', async (req, res) => {
  try {
    const { email } = req.body || {};
    const result = await validateEmailComprehensive(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ valid: false, message: err.message, code: 'VALIDATION_ERROR' });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail || !password || !displayName) {
      return res.status(400).json({
        error: 'Email, password, and display name are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const emailCheck = await validateEmailComprehensive(normalizedEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({
        error: emailCheck.message,
        code: emailCheck.code || 'INVALID_EMAIL',
        email: normalizedEmail,
      });
    }

    const passCheck = validatePasswordStrength(password, normalizedEmail, displayName);
    if (!passCheck.valid) {
      return res.status(400).json({
        error: passCheck.message,
        code: 'WEAK_PASSWORD',
      });
    }

    const result = await registerUser({ email: normalizedEmail, password, displayName });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message,
      code: err.code || 'REGISTER_FAILED',
      email: req.body?.email?.trim()?.toLowerCase(),
    });
  }
});

router.post('/auth/login', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const rawEmail = (req.body?.email || '').trim().toLowerCase();
  const rateLimitKey = `${ip}_${rawEmail}`;

  // Check brute-force lockout
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (rateLimit.locked) {
    return res.status(429).json({
      error: `Too many failed login attempts. Temporarily locked for security. Try again in ${rateLimit.minutesLeft} minute(s).`,
      code: 'ACCOUNT_LOCKED',
      email: rawEmail,
    });
  }

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await loginUser({ email, password });
    clearFailedLogin(rateLimitKey);
    res.json(result);
  } catch (err) {
    recordFailedLogin(rateLimitKey);
    res.status(401).json({
      error: err.message,
      code: err.code || 'LOGIN_FAILED',
      email: rawEmail,
    });
  }
});

/**
 * Send 6-digit OTP verification code to email
 */
router.post('/auth/otp/send', async (req, res) => {
  try {
    const rawEmail = (req.body?.email || '').trim().toLowerCase();
    if (!rawEmail) {
      return res.status(400).json({
        error: 'Email address is required to receive a verification code.',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!validateEmailFormat(rawEmail)) {
      return res.status(400).json({
        error: 'Please enter a valid email address (e.g. name@company.com).',
        code: 'INVALID_EMAIL',
      });
    }

    const otpCode = generateAndStoreOtp(rawEmail);
    console.log(`[Auth API] Sending OTP ${otpCode} to ${rawEmail}`);

    await sendOtpEmail({
      recipientEmail: rawEmail,
      otpCode,
      purpose: 'sign-in',
    });

    res.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${rawEmail}.`,
      email: rawEmail,
      // Provide dev hint if in local dev
      devCode: process.env.NODE_ENV === 'development' ? otpCode : undefined,
    });
  } catch (err) {
    console.error('[Auth API] Send OTP error:', err);
    res.status(500).json({
      error: err.message || 'Failed to dispatch verification code email.',
      code: 'OTP_SEND_FAILED',
    });
  }
});

/**
 * Verify 6-digit OTP code and authenticate user
 */
router.post('/auth/otp/verify', async (req, res) => {
  try {
    const rawEmail = (req.body?.email || '').trim().toLowerCase();
    const { otp, displayName } = req.body;

    if (!rawEmail || !otp) {
      return res.status(400).json({
        error: 'Both email and 6-digit verification code are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const verification = verifyOtpCode(rawEmail, otp);
    if (!verification.valid) {
      return res.status(400).json({
        error: verification.message,
        code: 'INVALID_OTP',
      });
    }

    // Auto-login or create user
    const result = await loginOrRegisterWithOtp({
      email: rawEmail,
      displayName: displayName || rawEmail.split('@')[0],
    });

    res.json(result);
  } catch (err) {
    console.error('[Auth API] Verify OTP error:', err);
    res.status(400).json({
      error: err.message || 'Verification failed. Please try again.',
      code: 'OTP_VERIFY_FAILED',
    });
  }
});

/**
 * Google Sign-In authentication & user provisioning
 */
router.post('/auth/google', async (req, res) => {
  try {
    let { email, displayName, avatarUrl, credential, googleId } = req.body;

    // If a Google ID token credential was provided (from Google Identity Services), decode it
    if (credential && typeof credential === 'string') {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload && payload.email) {
            email = email || payload.email;
            displayName = displayName || payload.name || payload.given_name;
            avatarUrl = avatarUrl || payload.picture;
            googleId = googleId || payload.sub;
          }
        }
      } catch (decodeErr) {
        console.warn('[Auth API] Could not decode Google credential JWT:', decodeErr.message);
      }
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !validateEmailFormat(normalizedEmail)) {
      return res.status(400).json({
        error: 'A valid Google email address is required.',
        code: 'INVALID_EMAIL',
      });
    }

    const result = await loginOrRegisterWithGoogle({
      email: normalizedEmail,
      displayName: displayName?.trim() || normalizedEmail.split('@')[0],
      avatarUrl: avatarUrl || null,
      googleId: googleId || null,
    });

    res.json(result);
  } catch (err) {
    console.error('[Auth API] Google sign-in error:', err);
    res.status(400).json({
      error: err.message || 'Google sign-in failed. Please try again.',
      code: 'GOOGLE_AUTH_FAILED',
    });
  }
});

/**
 * Returns suggested Google account detected from system/environment
 */
router.get('/auth/google/suggested', (req, res) => {
  res.json({
    email: null,
    displayName: null,
    avatarUrl: null,
  });
});

router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/auth/me', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const user = await updateUser(req.user.id, { avatarUrl });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await getAllUsers(req.user.id);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * CHAT ROOMS ENDPOINTS (Protected with individual auth)
 */
router.get('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await getUserRooms(req.user.id);
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const { type, name, memberIds, icon } = req.body;

    if (type === 'direct') {
      const otherUserId = memberIds?.[0];
      if (!otherUserId) {
        return res.status(400).json({ error: 'Target user ID is required for direct chat' });
      }
      const rawRoom = await getOrCreateDirectRoom(req.user.id, otherUserId);
      notifyRoomCreated(rawRoom);
      const room = await getEnrichedRoom(rawRoom, req.user.id);
      return res.status(201).json({ room });
    }

    if (type === 'group') {
      if (!name?.trim()) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      const rawRoom = await createGroupRoom({
        name,
        memberIds,
        createdBy: req.user.id,
        icon,
      });
      notifyRoomCreated(rawRoom);
      const room = await getEnrichedRoom(rawRoom, req.user.id);
      return res.status(201).json({ room });
    }

    res.status(400).json({ error: 'Invalid room type. Must be "direct" or "group"' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await getRoomMessages(req.params.roomId, req.user.id);
    res.json({ messages });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 404).json({ error: err.message });
  }
});

// REST Fallback endpoint for sending messages (guarantees delivery if WebSockets fail or are unavailable)
router.post('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { text, attachmentRef } = req.body;
    if (!text?.trim() && !attachmentRef) {
      return res.status(400).json({ error: 'Message text or attachment is required' });
    }

    const newMessage = await createMessage({
      roomId: req.params.roomId,
      senderId: req.user.id,
      text: text?.trim() || '',
      attachmentRef: attachmentRef || null,
    });

    broadcastNewMessage(newMessage, req.user);

    res.status(201).json({ message: newMessage });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 400).json({ error: err.message });
  }
});

router.post('/chat/rooms/:roomId/members', authMiddleware, async (req, res) => {
  try {
    const { newUserId } = req.body;
    if (!newUserId) return res.status(400).json({ error: 'newUserId is required' });

    const rawRoom = await addMemberToRoom(req.params.roomId, req.user.id, newUserId);
    notifyRoomCreated(rawRoom);
    const room = await getEnrichedRoom(rawRoom, req.user.id);
    res.json({ room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/chat/rooms/:roomId/members/:userId', authMiddleware, async (req, res) => {
  try {
    const rawRoom = await removeMemberFromRoom(req.params.roomId, req.user.id, req.params.userId);
    notifyRoomCreated(rawRoom);
    const room = await getEnrichedRoom(rawRoom, req.user.id);
    res.json({ room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/chat/rooms/:roomId/read', authMiddleware, async (req, res) => {
  try {
    const count = await markRoomMessagesAsRead(req.params.roomId, req.user.id);
    res.json({ readCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
