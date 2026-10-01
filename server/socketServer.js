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
export async function broadcastNewMessage(newMessage, senderUser = null) {
  if (!ioInstance || !newMessage) return;
  const roomId = newMessage.roomId || newMessage.conversationId;
  const isCommunity = roomId === 'room_aerodrop_global_community';
  const room = await getRoomById(roomId);

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
          // Direct socket emission: guarantees delivery even if room-join had a race condition
          ioInstance.to(sId).emit('new_message', newMessage);
          ioInstance.to(sId).emit('receive_message', newMessage);
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

  // 3. If community group, broadcast to all connected clients across the entire app
  if (isCommunity) {
    ioInstance.emit('new_message', newMessage);
    ioInstance.emit('receive_message', newMessage);
  } else {
    ioInstance.to(roomId).emit('new_message', newMessage);
    ioInstance.to(roomId).emit('receive_message', newMessage);
  }

  // 4. Broadcast room activity so conversation list updates snippet in real-time
  const activityPayload = {
    roomId,
    conversationId: roomId,
    lastMessageAt: newMessage.createdAt,
    lastMessageText: newMessage.text || (newMessage.attachmentRef ? '📎 File attached' : ''),
    senderName: newMessage.senderName || senderUser?.displayName || 'Someone',
  };

  if (isCommunity) {
    ioInstance.emit('room_activity', activityPayload);
  } else {
    ioInstance.to(roomId).emit('room_activity', activityPayload);
  }
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

    // Auto-join socket to all rooms user belongs to (non-blocking in background)
    getUserRooms(userId)
      .then((rooms) => {
        if (Array.isArray(rooms)) {
          rooms.forEach((room) => socket.join(room.id));
        }
      })
      .catch((e) => console.error('Error joining user rooms on connect:', e));

    // Client explicitly joins a specific conversation/room
    const handleJoinRoom = async (data, callback) => {
      try {
        const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
        if (!targetRoomId) {
          if (callback) callback({ error: 'Room / Conversation ID is required' });
          return;
        }

        // Always join socket to the channel immediately
        socket.join(targetRoomId);
        socket.currentRoomId = targetRoomId;

        if (callback) callback({ success: true, roomId: targetRoomId, conversationId: targetRoomId });
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
        const newMessage = await createMessage({
          roomId: targetRoomId,
          conversationId: targetRoomId,
          senderId: socket.user.id, // Strictly authenticated backend user!
          text: rawText?.trim() || '',
          content: rawText?.trim() || '',
          attachmentRef: attachmentRef || null,
        });

        // Broadcast to all room member sockets reliably
        await broadcastNewMessage(newMessage, socket.user);

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
    socket.on('mark_read', async (data) => {
      try {
        const targetRoomId = typeof data === 'string' ? data : (data?.roomId || data?.conversationId);
        if (targetRoomId) {
          const count = await markRoomMessagesAsRead(targetRoomId, socket.user.id);
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

    // ==========================================
    // Real-Time WebRTC Audio & Video Calling
    // ==========================================

    // 1. Initiate / Invite to Call
    socket.on('call:invite', async (data) => {
      try {
        const { callId, roomId, targetUserId, callType } = data || {};
        if (!roomId) return;

        const callerInfo = {
          callId: callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          callerId: socket.user.id,
          callerName: socket.user.displayName,
          callerColor: socket.user.color,
          callType: callType || 'audio',
          timestamp: new Date().toISOString(),
        };

        if (targetUserId) {
          // 1-on-1 Direct Chat: forward to target user's active sockets
          const targetSockets = userSockets.get(targetUserId);
          if (targetSockets && targetSockets.size > 0) {
            targetSockets.forEach((sId) => {
              const s = io.sockets.sockets.get(sId);
              if (s) s.emit('call:incoming', callerInfo);
              io.to(sId).emit('call:incoming', callerInfo);
            });
            socket.emit('call:ringing', { callId: callerInfo.callId, roomId, status: 'ringing' });
          } else {
            // Also broadcast to room as fallback
            socket.to(roomId).emit('call:incoming', callerInfo);
            socket.emit('call:ringing', { callId: callerInfo.callId, roomId, status: 'ringing' });
          }
        } else {
          // Group Call: forward to all other members in room
          const room = await getRoomById(roomId);
          if (room && Array.isArray(room.memberIds)) {
            let notifiedCount = 0;
            room.memberIds.forEach((mId) => {
              if (mId !== socket.user.id) {
                const sockSet = userSockets.get(mId);
                if (sockSet) {
                  sockSet.forEach((sId) => {
                    const s = io.sockets.sockets.get(sId);
                    if (s) s.emit('call:incoming', callerInfo);
                    io.to(sId).emit('call:incoming', callerInfo);
                    notifiedCount++;
                  });
                }
              }
            });
            socket.to(roomId).emit('call:incoming', callerInfo);
            socket.emit('call:ringing', { callId: callerInfo.callId, roomId, status: 'ringing' });
          } else {
            socket.to(roomId).emit('call:incoming', callerInfo);
            socket.emit('call:ringing', { callId: callerInfo.callId, roomId, status: 'ringing' });
          }
        }
      } catch (err) {
        console.error('call:invite error:', err);
      }
    });

    // 2. Answer / Accept Call
    socket.on('call:accept', (data) => {
      try {
        const { callId, roomId, callerId } = data || {};
        const payload = {
          callId,
          roomId,
          answererId: socket.user.id,
          answererName: socket.user.displayName,
        };
        if (callerId) {
          const callerSockets = userSockets.get(callerId);
          if (callerSockets && callerSockets.size > 0) {
            callerSockets.forEach((sId) => {
              io.to(sId).emit('call:accepted', payload);
            });
          } else if (roomId) {
            socket.to(roomId).emit('call:accepted', payload);
          }
        } else if (roomId) {
          socket.to(roomId).emit('call:accepted', payload);
        }
      } catch (err) {
        console.error('call:accept error:', err);
      }
    });

    // 3. Decline / Reject Call
    socket.on('call:decline', (data) => {
      try {
        const { callId, roomId, callerId, reason } = data || {};
        const payload = {
          callId,
          roomId,
          reason: reason || 'declined',
          answererId: socket.user.id,
          answererName: socket.user.displayName,
        };
        if (callerId) {
          const callerSockets = userSockets.get(callerId);
          if (callerSockets && callerSockets.size > 0) {
            callerSockets.forEach((sId) => {
              io.to(sId).emit('call:declined', payload);
            });
          } else if (roomId) {
            socket.to(roomId).emit('call:declined', payload);
          }
        } else if (roomId) {
          socket.to(roomId).emit('call:declined', payload);
        }
      } catch (err) {
        console.error('call:decline error:', err);
      }
    });

    // 4. WebRTC SDP & ICE Candidate Signaling
    socket.on('call:signal', (data) => {
      try {
        const { callId, roomId, targetUserId, signal } = data || {};
        const payload = {
          callId,
          roomId,
          senderId: socket.user.id,
          targetUserId,
          signal,
        };

        if (targetUserId) {
          const targetSockets = userSockets.get(targetUserId);
          if (targetSockets && targetSockets.size > 0) {
            targetSockets.forEach((sId) => {
              io.to(sId).emit('call:signal', payload);
            });
          } else if (roomId) {
            socket.to(roomId).emit('call:signal', payload);
          }
        } else if (roomId) {
          socket.to(roomId).emit('call:signal', payload);
        }
      } catch (err) {
        console.error('call:signal error:', err);
      }
    });

    // 5. Terminate / End Call
    socket.on('call:end', (data) => {
      try {
        const { callId, roomId, targetUserId, duration } = data || {};
        const payload = {
          callId,
          roomId,
          senderId: socket.user.id,
          duration,
        };
        if (targetUserId) {
          const targetSockets = userSockets.get(targetUserId);
          if (targetSockets && targetSockets.size > 0) {
            targetSockets.forEach((sId) => {
              io.to(sId).emit('call:ended', payload);
            });
          } else if (roomId) {
            socket.to(roomId).emit('call:ended', payload);
          }
        } else if (roomId) {
          socket.to(roomId).emit('call:ended', payload);
        }
      } catch (err) {
        console.error('call:end error:', err);
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