import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useChatSocket(token) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // roomId -> Map(userId -> displayName)
  const joinedRoomsRef = useRef(new Set());

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // Connect to Socket.io with JWT auth token
    const newSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[ChatSocket] Connected to real-time server');
      setIsConnected(true);
      // Re-join any previously joined rooms upon reconnect
      joinedRoomsRef.current.forEach((roomId) => {
        newSocket.emit('join_room', roomId);
      });
    });

    newSocket.on('disconnect', () => {
      console.log('[ChatSocket] Disconnected from server');
      setIsConnected(false);
    });

    // Presence listeners: immediate online users hydration and real-time status updates
    newSocket.on('online_users', (userIds) => {
      if (Array.isArray(userIds)) {
        setOnlineUserIds(new Set(userIds));
      }
    });

    newSocket.on('presence_state', (payload) => {
      if (Array.isArray(payload?.onlineUserIds)) {
        setOnlineUserIds(new Set(payload.onlineUserIds));
      }
    });

    newSocket.on('user_online', ({ userId }) => {
      if (userId) {
        setOnlineUserIds((prev) => new Set([...prev, userId]));
      }
    });

    newSocket.on('user_offline', ({ userId }) => {
      if (userId) {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    });

    newSocket.on('presence_update', ({ userId, status }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (status === 'online') {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
    });

    newSocket.on('user_typing', ({ roomId, conversationId, userId, displayName, isTyping }) => {
      const targetId = roomId || conversationId;
      if (!targetId) return;
      setTypingUsers((prev) => {
        const roomTyping = { ...(prev[targetId] || {}) };
        if (isTyping) {
          roomTyping[userId] = displayName;
        } else {
          delete roomTyping[userId];
        }
        return { ...prev, [targetId]: roomTyping };
      });
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [token]);

  const joinRoom = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : (roomId?.roomId || roomId?.conversationId);
    if (!targetId) return;
    joinedRoomsRef.current.add(targetId);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_room', targetId);
    }
  }, []);

  const joinConversation = useCallback((conversationId) => {
    joinRoom(conversationId);
  }, [joinRoom]);

  const sendMessage = useCallback(async (roomIdOrData, textParam, attachmentParam = null) => {
    let targetRoomId;
    let targetText;
    let attachmentRef;

    if (typeof roomIdOrData === 'object' && roomIdOrData !== null) {
      targetRoomId = roomIdOrData.roomId || roomIdOrData.conversationId;
      targetText = roomIdOrData.text !== undefined ? roomIdOrData.text : roomIdOrData.content;
      attachmentRef = roomIdOrData.attachmentRef || null;
    } else {
      targetRoomId = roomIdOrData;
      targetText = textParam;
      attachmentRef = attachmentParam;
    }

    if (!targetRoomId) throw new Error('Room / Conversation ID is required');

    // 1. Try WebSocket first for real-time instantaneous delivery
    if (socketRef.current && socketRef.current.connected) {
      try {
        const msg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Socket timeout')), 3500);
          socketRef.current.emit(
            'send_message',
            { roomId: targetRoomId, conversationId: targetRoomId, text: targetText, content: targetText, attachmentRef },
            (response) => {
              clearTimeout(timer);
              if (response?.error) {
                reject(new Error(response.error));
              } else {
                resolve(response.message);
              }
            }
          );
        });
        return msg;
      } catch (socketErr) {
        console.warn('[useChatSocket] WebSocket send failed or timed out, trying HTTP fallback:', socketErr.message);
      }
    }

    // 2. HTTP REST Fallback: guarantees 100% send delivery even if WebSocket dropped
    if (!token) throw new Error('Authentication required');
    const res = await fetch(`/api/chat/rooms/${targetRoomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: targetText, content: targetText, attachmentRef }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send message');
    }
    return data.message;
  }, [token]);

  const startTyping = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : (roomId?.roomId || roomId?.conversationId);
    if (socketRef.current && targetId) {
      socketRef.current.emit('typing_start', { roomId: targetId, conversationId: targetId });
    }
  }, []);

  const stopTyping = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : (roomId?.roomId || roomId?.conversationId);
    if (socketRef.current && targetId) {
      socketRef.current.emit('typing_stop', { roomId: targetId, conversationId: targetId });
    }
  }, []);

  const markRead = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : (roomId?.roomId || roomId?.conversationId);
    if (socketRef.current && targetId) {
      socketRef.current.emit('mark_read', { roomId: targetId, conversationId: targetId });
    }
  }, []);

  return {
    socket,
    isConnected,
    onlineUserIds,
    typingUsers,
    joinRoom,
    joinConversation,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
  };
}
