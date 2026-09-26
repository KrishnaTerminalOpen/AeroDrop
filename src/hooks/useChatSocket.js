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

    newSocket.on('user_typing', ({ roomId, userId, displayName, isTyping }) => {
      setTypingUsers((prev) => {
        const roomTyping = { ...(prev[roomId] || {}) };
        if (isTyping) {
          roomTyping[userId] = displayName;
        } else {
          delete roomTyping[userId];
        }
        return { ...prev, [roomId]: roomTyping };
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
    if (!roomId) return;
    joinedRoomsRef.current.add(roomId);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_room', roomId);
    }
  }, []);

  const sendMessage = useCallback(async (roomId, text, attachmentRef = null) => {
    if (!roomId) throw new Error('Room ID is required');

    // 1. Try WebSocket first for real-time instantaneous delivery
    if (socketRef.current && socketRef.current.connected) {
      try {
        const msg = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Socket timeout')), 3500);
          socketRef.current.emit(
            'send_message',
            { roomId, text, attachmentRef },
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
    const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, attachmentRef }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send message');
    }
    return data.message;
  }, [token]);

  const startTyping = useCallback((roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_start', { roomId });
    }
  }, []);

  const stopTyping = useCallback((roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_stop', { roomId });
    }
  }, []);

  const markRead = useCallback((roomId) => {
    if (socketRef.current) {
      socketRef.current.emit('mark_read', { roomId });
    }
  }, []);

  return {
    socket,
    isConnected,
    onlineUserIds,
    typingUsers,
    joinRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
  };
}
