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

  // 3. Clean single broadcast to room channel with both new_message and receive_message events
  ioInstance.to(roomId).emit('new_message', newMessage);
  ioInstance.to(roomId).emit('receive_message', newMessage);

  // 4. Broadcast room activity so conversation list updates snippet in real-time
  ioInstance.to(roomId).emit('room_activity', {
    roomId,
    conversationId: roomId,
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

    // Track user active sockets and determine first connection for presence broadcast
    const isFirstConnection = !userSockets.has(userId) || userSockets.get(userId).size === 0;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    if (isFirstConnection) {
      updateUserOnlineStatus(userId, 'online');
      const presencePayload = {
        userId,
        status: 'online',
        displayName: socket.user.displayName,
      };
      // Broadcast presence events to all other connected clients
      socket.broadcast.emit('user_online', presencePayload);
      socket.broadcast.emit('presence_update', presencePayload);
    }

    // Immediately hydrate this newly connected socket with all currently online user IDs
    const onlineIds = Array.from(userSockets.keys());
    socket.emit('online_users', onlineIds);
    socket.emit('presence_state', { onlineUserIds: onlineIds });

    // Auto-join socket to all rooms user belongs to
    try {
      const rooms = getUserRooms(userId);
      rooms.forEach((room) => {
        socket.join(room.id);
      });
    } catch (e) {
      console.error('Error joining user rooms on connect:', e);
    }

    // Client explicitly joins a specific conversation/room (leaving any previous conversation room)
    const handleJoinRoom = (data, callback) => {
      try {
        const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
        if (!targetRoomId) {
          if (callback) callback({ error: 'Room / Conversation ID is required' });
          return;
        }

        const rooms = getUserRooms(userId);
        if (rooms.some((r) => r.id === targetRoomId)) {
          // Track which conversation is actively focused, but do NOT leave other
          // rooms — the socket must stay joined to every room the user belongs to
          // (including group chats) so it keeps receiving live events for
          // conversations the user isn't currently looking at.
          socket.join(targetRoomId);
          socket.currentRoomId = targetRoomId;
          if (callback) callback({ success: true, roomId: targetRoomId, conversationId: targetRoomId });
        } else {
          if (callback) callback({ error: 'Not a member of this room' });
        }
      } catch (err) {
        console.error('join_room error:', err);
        if (callback) callback({ error: err.message });
      }
    };

    socket.on('join_room', handleJoinRoom);
    socket.on('join_conversation', handleJoinRoom);

    // Real-time message sending with strict server-side attribution and rate limiting
    const handleSendMessage = async (data, callback) => {
      try {
        const targetRoomId = data.roomId || data.conversationId;
        const rawText = data.text !== undefined && data.text !== null ? data.text : data.content;
        const { attachmentRef } = data;

        if (!targetRoomId || (!rawText?.trim() && !attachmentRef)) {
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
        socket.join(targetRoomId);
        socket.currentRoomId = targetRoomId;

        // CREATE MESSAGE: senderId, name, avatar ALWAYS come from authenticated socket.user
        const newMessage = createMessage({
          roomId: targetRoomId,
          conversationId: targetRoomId,
          senderId: socket.user.id, // Strictly authenticated backend user!
          text: rawText?.trim() || '',
          content: rawText?.trim() || '',
          attachmentRef: attachmentRef || null,
        });

        // Broadcast to all room member sockets reliably
        broadcastNewMessage(newMessage, socket.user);

        if (callback) callback({ success: true, message: newMessage });
      } catch (err) {
        console.error('send_message error:', err);
        if (callback) callback({ error: err.message });
      }
    };

    socket.on('send_message', handleSendMessage);
    socket.on('send_conversation_message', handleSendMessage);

    // Typing Indicators (lightweight, not stored in DB)
    socket.on('typing_start', (data) => {
      const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
      if (targetRoomId) {
        socket.to(targetRoomId).emit('user_typing', {
          roomId: targetRoomId,
          conversationId: targetRoomId,
          userId: socket.user.id,
          displayName: socket.user.displayName,
          isTyping: true,
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
      if (targetRoomId) {
        socket.to(targetRoomId).emit('user_typing', {
          roomId: targetRoomId,
          conversationId: targetRoomId,
          userId: socket.user.id,
          displayName: socket.user.displayName,
          isTyping: false,
        });
      }
    });

    // Read Receipts
    socket.on('mark_read', (data) => {
      try {
        const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
        if (targetRoomId) {
          const count = markRoomMessagesAsRead(targetRoomId, socket.user.id);
          if (count > 0) {
            io.to(targetRoomId).emit('messages_read', {
              roomId: targetRoomId,
              conversationId: targetRoomId,
              userId: socket.user.id,
              timestamp: new Date().toISOString(),
            });
          }
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
          const offlinePayload = {
            userId,
            status: 'offline',
            lastSeenAt: new Date().toISOString(),
            displayName: socket.user.displayName,
          };
          io.emit('user_offline', offlinePayload);
          io.emit('presence_update', offlinePayload);
          console.log(`[Socket] User went offline: ${socket.user.displayName}`);
        }
      }
    });
  });

  return io;
}