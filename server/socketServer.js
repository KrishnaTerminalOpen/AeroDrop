import { Server } from 'socket.io';
import { verifyJwtToken, updateUserOnlineStatus, getUserById } from './auth.js';
import {
  createMessage,
  markRoomMessagesAsRead,
  markMessageDelivered,
  getUserRooms,
  getRoomById,
  getEnrichedRoom,
} from './chatStorage.js';

// Map: userId -> Set of socket IDs
const userSockets = new Map();

// Rate limiting map: userId -> [timestamps]
const userMessageRateMap = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5000;

let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function notifyRoomCreated(room) {
  if (!ioInstance || !room) return;
  const memberIds = room.memberIds || [];
  memberIds.forEach((mId) => {
    const sockIds = userSockets.get(mId);
    const enrichedRoom = getEnrichedRoom(room, mId) || room;
    if (sockIds) {
      sockIds.forEach((sId) => {
        const s = ioInstance.sockets.sockets.get(sId);
        if (s) {
          s.join(room.id);
          s.emit('room_created', enrichedRoom);
        }
      });
    }
  });
}

/**
 * Cleanly broadcasts a new message to all active sockets of room members and updates room activity
 */
export function broadcastNewMessage(newMessage, senderUser = null) {
  if (!ioInstance || !newMessage) return;
  const roomId = newMessage.roomId;
  const room = getRoomById(roomId);

  if (room && Array.isArray(room.memberIds)) {
    // 1. Ensure all active sockets for each room member are joined to the room channel
    room.memberIds.forEach((mId) => {
      const sockIds = userSockets.get(mId);
      if (sockIds) {
        sockIds.forEach((sId) => {
          const s = ioInstance.sockets.sockets.get(sId);
          if (s) {
            s.join(roomId);
          }
        });
      }
    });

    // 2. Mark as delivered to all online members currently connected
    room.memberIds.forEach((mId) => {
      if (mId !== newMessage.senderId && userSockets.has(mId)) {
        markMessageDelivered(newMessage.id, mId);
      }
    });
  }

  // 3. Clean single broadcast to room channel
  ioInstance.to(roomId).emit('new_message', newMessage);

  // 4. Broadcast room activity so conversation list updates snippet in real-time
  ioInstance.to(roomId).emit('room_activity', {
    roomId,
    lastMessageAt: newMessage.createdAt,
    lastMessageText: newMessage.text || (newMessage.attachmentRef ? '📎 File attached' : ''),
    senderName: newMessage.senderName || senderUser?.displayName || 'Someone',
  });
}

export function setupSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  ioInstance = io;

  // Authentication Middleware for WebSocket handshakes
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const decoded = verifyJwtToken(token);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    // Attach authenticated user profile directly to socket
    socket.user = decoded;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    console.log(`[Socket] User connected: ${socket.user.displayName} (${userId})`);

    // Track user active sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
      updateUserOnlineStatus(userId, 'online');
      // Broadcast online status to all
      io.emit('presence_update', {
        userId,
        status: 'online',
        displayName: socket.user.displayName,
      });
    }
    userSockets.get(userId).add(socket.id);

    // Auto-join socket to all rooms user belongs to
    try {
      const rooms = getUserRooms(userId);
      rooms.forEach((room) => {
        socket.join(room.id);
      });
    } catch (e) {
      console.error('Error joining user rooms on connect:', e);
    }

    // Client explicitly joins a specific room
    socket.on('join_room', (roomId, callback) => {
      try {
        const rooms = getUserRooms(userId);
        if (rooms.some((r) => r.id === roomId)) {
          socket.join(roomId);
          if (callback) callback({ success: true });
        } else {
          if (callback) callback({ error: 'Not a member of this room' });
        }
      } catch (err) {
        console.error('join_room error:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // Real-time message sending with strict server-side attribution and rate limiting
    socket.on('send_message', async (data, callback) => {
      try {
        const { roomId, text, attachmentRef } = data;

        if (!roomId || (!text?.trim() && !attachmentRef)) {
          if (callback) callback({ error: 'Message text or attachment is required' });
          return;
        }

        // Rate limiting check
        const now = Date.now();
        const timestamps = userMessageRateMap.get(userId) || [];
        const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
        if (recent.length >= RATE_LIMIT_MAX) {
          if (callback) callback({ error: 'Slow down! Too many messages sent in a short window.' });
          return;
        }
        recent.push(now);
        userMessageRateMap.set(userId, recent);

        // Ensure the sender's socket is joined to the room
        socket.join(roomId);

        // CREATE MESSAGE: senderId, name, avatar ALWAYS come from authenticated socket.user
        const newMessage = createMessage({
          roomId,
          senderId: socket.user.id, // Strictly authenticated backend user!
          text: text?.trim() || '',
          attachmentRef: attachmentRef || null,
        });

        // Broadcast to all room member sockets reliably
        broadcastNewMessage(newMessage, socket.user);

        if (callback) callback({ success: true, message: newMessage });
      } catch (err) {
        console.error('send_message error:', err);
        if (callback) callback({ error: err.message });
      }
    });

    // Typing Indicators (lightweight, not stored in DB)
    socket.on('typing_start', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', {
        roomId,
        userId: socket.user.id,
        displayName: socket.user.displayName,
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', {
        roomId,
        userId: socket.user.id,
        displayName: socket.user.displayName,
        isTyping: false,
      });
    });

    // Read Receipts
    socket.on('mark_read', ({ roomId }) => {
      try {
        const count = markRoomMessagesAsRead(roomId, socket.user.id);
        if (count > 0) {
          io.to(roomId).emit('messages_read', {
            roomId,
            userId: socket.user.id,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('mark_read error:', err);
      }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          updateUserOnlineStatus(userId, 'offline');
          io.emit('presence_update', {
            userId,
            status: 'offline',
            lastSeenAt: new Date().toISOString(),
          });
          console.log(`[Socket] User went offline: ${socket.user.displayName}`);
        }
      }
    });
  });

  return io;
}
