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
} from './chatStorage.js';

const router = express.Router();

/**
 * AUTHENTICATION ENDPOINTS
 */
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const result = await registerUser({ email, password, displayName });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await loginUser({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/auth/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.get('/users', authMiddleware, (req, res) => {
  const users = getAllUsers(req.user.id);
  res.json({ users });
});

/**
 * CHAT ROOMS ENDPOINTS (Protected with individual auth)
 */
router.get('/chat/rooms', authMiddleware, (req, res) => {
  try {
    const rooms = getUserRooms(req.user.id);
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat/rooms', authMiddleware, (req, res) => {
  try {
    const { type, name, memberIds, icon } = req.body;

    if (type === 'direct') {
      const otherUserId = memberIds?.[0];
      if (!otherUserId) {
        return res.status(400).json({ error: 'Target user ID is required for direct chat' });
      }
      const room = getOrCreateDirectRoom(req.user.id, otherUserId);
      return res.status(201).json({ room });
    }

    if (type === 'group') {
      if (!name?.trim()) {
        return res.status(400).json({ error: 'Group name is required' });
      }
      const room = createGroupRoom({
        name,
        memberIds,
        createdBy: req.user.id,
        icon,
      });
      return res.status(201).json({ room });
    }

    res.status(400).json({ error: 'Invalid room type. Must be "direct" or "group"' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/chat/rooms/:roomId/messages', authMiddleware, (req, res) => {
  try {
    const messages = getRoomMessages(req.params.roomId, req.user.id);
    res.json({ messages });
  } catch (err) {
    res.status(err.message.includes('Forbidden') ? 403 : 404).json({ error: err.message });
  }
});

router.post('/chat/rooms/:roomId/members', authMiddleware, (req, res) => {
  try {
    const { newUserId } = req.body;
    if (!newUserId) return res.status(400).json({ error: 'newUserId is required' });

    const room = addMemberToRoom(req.params.roomId, req.user.id, newUserId);
    res.json({ room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/chat/rooms/:roomId/members/:userId', authMiddleware, (req, res) => {
  try {
    const room = removeMemberFromRoom(req.params.roomId, req.user.id, req.params.userId);
    res.json({ room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/chat/rooms/:roomId/read', authMiddleware, (req, res) => {
  try {
    const count = markRoomMessagesAsRead(req.params.roomId, req.user.id);
    res.json({ readCount: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
