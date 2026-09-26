import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { supabase, isSupabaseFrontendConfigured } from '../lib/supabaseClient';

export function useChatSocket(token) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // roomId -> Map(userId -> displayName)
  const joinedRoomsRef = useRef(new Set());
  const listenersRef = useRef(new Map()); // eventName -> Set(callbacks)

  // Current user decoded from token
  const currentUserRef = useRef(null);
  useEffect(() => {
    if (!token) {
      currentUserRef.current = null;
      return;
    }
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        currentUserRef.current = JSON.parse(atob(parts[1]));
      }
    } catch (e) {
      currentUserRef.current = null;
    }
  }, [token]);

  // Dispatch custom events to registered listeners
  const triggerEvent = useCallback((eventName, payload) => {
    const callbacks = listenersRef.current.get(eventName);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[ChatSocket] Error in listener for ${eventName}:`, err);
        }
      });
    }
  }, []);

  // Set up Supabase Realtime when configured
  useEffect(() => {
    if (!isSupabaseFrontendConfigured || !supabase || !token) return;

    console.log('[SupabaseRealtime] Initializing Supabase Realtime subscriptions...');
    setIsConnected(true);

    // 1. Messages Realtime channel
    const messagesChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const row = payload.new;
          if (!row) return;

          // Format incoming message
          const textVal = row.text || row.content || '';
          const formattedMsg = {
            id: row.id,
            roomId: row.room_id,
            conversationId: row.conversation_id || row.room_id,
            senderId: row.sender_id,
            receiverId: row.receiver_id,
            text: textVal,
            content: textVal,
            attachmentRef: row.attachment_ref,
            createdAt: row.created_at,
            editedAt: row.edited_at,
            deliveredTo: row.delivered_to || [],
            readBy: row.read_by || [],
          };

          // Trigger listeners
          triggerEvent('receive_message', formattedMsg);
          triggerEvent('new_message', formattedMsg);
          triggerEvent('room_activity', {
            roomId: row.room_id,
            lastMessageText: textVal || (row.attachment_ref ? '📎 File attached' : ''),
            lastMessageAt: row.created_at,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          triggerEvent('messages_read', {
            roomId: row.room_id,
            messageId: row.id,
            readBy: row.read_by,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[SupabaseRealtime] Subscribed to messages channel');
        }
      });

    // 2. Chat Rooms Realtime channel
    const roomsChannel = supabase
      .channel('public:chat_rooms')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_rooms' },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          triggerEvent('room_created', {
            id: row.id,
            name: row.name,
            type: row.type,
            icon: row.icon,
            memberIds: row.member_ids || [],
            createdBy: row.created_by,
            createdAt: row.created_at,
            lastMessageAt: row.last_message_at,
            lastMessageText: row.last_message_text,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_rooms' },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          triggerEvent('room_activity', {
            roomId: row.id,
            lastMessageText: row.last_message_text,
            lastMessageAt: row.last_message_at,
          });
        }
      )
      .subscribe();

    // 3. User Presence Realtime Channel
    const currentUserId = currentUserRef.current?.id;
    const presenceChannel = supabase.channel('aerodrop_presence', {
      config: { presence: { key: currentUserId || 'anon' } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const activeIds = Object.keys(state).filter((k) => k !== 'anon');
        setOnlineUserIds(new Set(activeIds));
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key && key !== 'anon') {
          setOnlineUserIds((prev) => new Set([...prev, key]));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key && key !== 'anon') {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUserId) {
          await presenceChannel.track({
            userId: currentUserId,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    // 4. Typing broadcast channel
    const typingChannel = supabase
      .channel('aerodrop_typing')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { roomId, userId, displayName, isTyping } = payload || {};
        if (!roomId || !userId) return;
        setTypingUsers((prev) => {
          const roomTyping = { ...(prev[roomId] || {}) };
          if (isTyping) {
            roomTyping[userId] = displayName || 'User';
          } else {
            delete roomTyping[userId];
          }
          return { ...prev, [roomId]: roomTyping };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [token, triggerEvent]);

  // Set up local Socket.IO connection (for local development or hybrid setups)
  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      if (!isSupabaseFrontendConfigured) setIsConnected(false);
      return;
    }

    const newSocket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      timeout: 5000,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('[ChatSocket] Connected to server via Socket.io');
      setIsConnected(true);
      joinedRoomsRef.current.forEach((roomId) => {
        newSocket.emit('join_room', roomId);
      });
    });

    newSocket.on('disconnect', () => {
      console.log('[ChatSocket] Socket.io disconnected');
      if (!isSupabaseFrontendConfigured) {
        setIsConnected(false);
      }
    });

    // Forward socket events to listeners and update presence
    const forwardEvent = (evt) => (data) => {
      triggerEvent(evt, data);
    };

    newSocket.on('receive_message', forwardEvent('receive_message'));
    newSocket.on('new_message', forwardEvent('new_message'));
    newSocket.on('room_activity', forwardEvent('room_activity'));
    newSocket.on('messages_read', forwardEvent('messages_read'));
    newSocket.on('room_created', forwardEvent('room_created'));

    newSocket.on('online_users', (userIds) => {
      if (Array.isArray(userIds) && !isSupabaseFrontendConfigured) {
        setOnlineUserIds(new Set(userIds));
      }
    });

    newSocket.on('user_online', ({ userId }) => {
      if (userId && !isSupabaseFrontendConfigured) {
        setOnlineUserIds((prev) => new Set([...prev, userId]));
      }
    });

    newSocket.on('user_offline', ({ userId }) => {
      if (userId && !isSupabaseFrontendConfigured) {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
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

    // Create a unified socket controller object for ChatView
    const unifiedSocket = {
      connected: newSocket.connected || isSupabaseFrontendConfigured,
      on: (event, callback) => {
        if (!listenersRef.current.has(event)) {
          listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(callback);
        newSocket.on(event, callback);
      },
      off: (event, callback) => {
        const callbacks = listenersRef.current.get(event);
        if (callbacks) {
          callbacks.delete(callback);
        }
        newSocket.off(event, callback);
      },
      emit: (event, data, cb) => {
        if (newSocket.connected) {
          newSocket.emit(event, data, cb);
        }
      },
    };

    setSocket(unifiedSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      if (!isSupabaseFrontendConfigured) setIsConnected(false);
    };
  }, [token, triggerEvent]);

  const joinRoom = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : roomId?.roomId || roomId?.conversationId;
    if (!targetId) return;
    joinedRoomsRef.current.add(targetId);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('join_room', targetId);
    }
  }, []);

  const joinConversation = useCallback(
    (conversationId) => {
      joinRoom(conversationId);
    },
    [joinRoom]
  );

  const sendMessage = useCallback(
    async (roomIdOrData, textParam, attachmentParam = null) => {
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
        attachmentParam = attachmentParam || null;
        attachmentRef = attachmentParam;
      }

      if (!targetRoomId) throw new Error('Room / Conversation ID is required');

      // 1. Try WebSocket first if available and connected
      if (socketRef.current && socketRef.current.connected) {
        try {
          const msg = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Socket timeout')), 3500);
            socketRef.current.emit(
              'send_message',
              {
                roomId: targetRoomId,
                conversationId: targetRoomId,
                text: targetText,
                content: targetText,
                attachmentRef,
              },
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
          console.warn('[useChatSocket] WebSocket send failed or timed out, using HTTP fallback:', socketErr.message);
        }
      }

      // 2. HTTP REST Fallback: guarantees 100% send delivery into Supabase / DB
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
    },
    [token]
  );

  const startTyping = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : roomId?.roomId || roomId?.conversationId;
    if (socketRef.current && socketRef.current.connected && targetId) {
      socketRef.current.emit('typing_start', { roomId: targetId, conversationId: targetId });
    }
    if (isSupabaseFrontendConfigured && supabase && targetId) {
      supabase.channel('aerodrop_typing').send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          roomId: targetId,
          userId: currentUserRef.current?.id,
          displayName: currentUserRef.current?.displayName,
          isTyping: true,
        },
      });
    }
  }, []);

  const stopTyping = useCallback((roomId) => {
    const targetId = typeof roomId === 'string' ? roomId : roomId?.roomId || roomId?.conversationId;
    if (socketRef.current && socketRef.current.connected && targetId) {
      socketRef.current.emit('typing_stop', { roomId: targetId, conversationId: targetId });
    }
    if (isSupabaseFrontendConfigured && supabase && targetId) {
      supabase.channel('aerodrop_typing').send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          roomId: targetId,
          userId: currentUserRef.current?.id,
          displayName: currentUserRef.current?.displayName,
          isTyping: false,
        },
      });
    }
  }, []);

  const markRead = useCallback(
    (roomId) => {
      const targetId = typeof roomId === 'string' ? roomId : roomId?.roomId || roomId?.conversationId;
      if (socketRef.current && socketRef.current.connected && targetId) {
        socketRef.current.emit('mark_read', { roomId: targetId, conversationId: targetId });
      }
      if (targetId && token) {
        fetch(`/api/chat/rooms/${targetId}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    },
    [token]
  );

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
