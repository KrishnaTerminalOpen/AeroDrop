import express from 'express';
import {
  registerUser,
  loginUser,
  getAllUsers,
  authMiddleware,
  getUserById,
} from './auth.js';
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
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({
        error: 'Email, password, and display name are required',
        code: 'VALIDATION_ERROR',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    const result = await registerUser({ email, password, displayName });
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

router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
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
