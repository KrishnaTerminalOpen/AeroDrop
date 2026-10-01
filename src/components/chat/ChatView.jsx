import React, { useState, useEffect, useCallback } from 'react';
import ConversationList from './ConversationList';
import ActiveChat from './ActiveChat';
import NewChatModal from './NewChatModal';
import GroupInfoDrawer from './GroupInfoDrawer';
import AuthModal from './AuthModal';
import CallModal from './CallModal';
import IncomingCallModal from './IncomingCallModal';
import { useAuth } from '../../hooks/useAuth';
import { useChatSocket } from '../../hooks/useChatSocket';
import { MessageSquare, Users, Shield, LogIn } from 'lucide-react';

const DEFAULT_COMMUNITY_ROOM = {
  id: 'room_aerodrop_global_community',
  name: 'AeroDrop Community Group',
  displayTitle: 'AeroDrop Community Group',
  type: 'group',
  avatarInitials: 'AC',
  avatarColor: '#4f46e5',
  lastMessageText: 'Welcome to AeroDrop Global Community Group Chat!',
  lastMessageAt: new Date().toISOString(),
  unreadCount: 0,
  members: [],
};

const DEFAULT_WELCOME_MSG = {
  id: 'msg_welcome_seed',
  roomId: 'room_aerodrop_global_community',
  conversationId: 'room_aerodrop_global_community',
  senderId: 'system',
  senderName: 'AeroDrop Community Bot',
  senderInitials: 'AD',
  senderColor: '#4f46e5',
  text: '👋 Welcome to the AeroDrop Community Group Chat! You can collaborate here in real-time, exchange instant messages, and share direct attachments.',
  content: '👋 Welcome to the AeroDrop Community Group Chat! You can collaborate here in real-time, exchange instant messages, and share direct attachments.',
  createdAt: new Date().toISOString(),
  readBy: [],
};

export default function ChatView({ showToast, onOpenAuth, initiallyOpenNewChat = false }) {
  const { currentUser, token, isAuthenticated } = useAuth();

  // Instant Zero-Delay State Layer: initialized directly so group chat displays with ZERO delay
  const [rooms, setRooms] = useState(() => {
    try {
      const cached = localStorage.getItem('aerodrop_cached_rooms');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) return parsed;
      }
      return [DEFAULT_COMMUNITY_ROOM];
    } catch (e) {
      return [DEFAULT_COMMUNITY_ROOM];
    }
  });

  const [activeRoomId, setActiveRoomId] = useState(() => {
    try {
      const cachedActive = localStorage.getItem('aerodrop_cached_active_room_id');
      if (cachedActive) return cachedActive;
      const cachedRooms = localStorage.getItem('aerodrop_cached_rooms');
      if (cachedRooms) {
        const parsed = JSON.parse(cachedRooms);
        const group = parsed.find((r) => r.type === 'group');
        if (group) return group.id;
        if (parsed.length > 0) return parsed[0].id;
      }
      return 'room_aerodrop_global_community';
    } catch (e) {
      return 'room_aerodrop_global_community';
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const cachedActive = localStorage.getItem('aerodrop_cached_active_room_id') || 'room_aerodrop_global_community';
      const cachedMsgs = localStorage.getItem(`aerodrop_cached_msgs_${cachedActive}`);
      if (cachedMsgs) {
        const parsed = JSON.parse(cachedMsgs);
        if (parsed.length > 0) return parsed;
      }
      if (cachedActive === 'room_aerodrop_global_community') {
        return [DEFAULT_WELCOME_MSG];
      }
      return [];
    } catch (e) {
      return [DEFAULT_WELCOME_MSG];
    }
  });

  // Zero-delay: rooms are already ready to display
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Modals & Calls
  const [isNewChatOpen, setIsNewChatOpen] = useState(initiallyOpenNewChat);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  // Mobile layout state: default directly to 'chat' so group chat UI displays immediately
  const [mobileView, setMobileView] = useState('chat');

  // Socket Hook
  const {
    socket,
    isConnected,
    onlineUserIds,
    typingUsers,
    joinRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
  } = useChatSocket(token);

  // Fetch rooms with multi-tier caching and parallel history prefetching
  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/chat/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedRooms = data.rooms || [];
        setRooms(loadedRooms);
        try {
          localStorage.setItem('aerodrop_cached_rooms', JSON.stringify(loadedRooms));
          if (currentUser?.id) {
            localStorage.setItem(`aerodrop_cached_rooms_${currentUser.id}`, JSON.stringify(loadedRooms));
          }
        } catch (e) {}

        // Auto-select first room or last active room if none selected
        if (!activeRoomIdRef.current && loadedRooms.length > 0) {
          const lastActive = localStorage.getItem('aerodrop_cached_active_room_id');
          const toSelect = loadedRooms.find((r) => r.id === lastActive)?.id || loadedRooms[0].id;
          setActiveRoomId(toSelect);
        }

        // Cache messages for all rooms so switching chats is 100% instantaneous
        loadedRooms.forEach((r) => {
          fetch(`/api/chat/rooms/${r.id}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((mRes) => mRes.json())
            .then((mVal) => {
              if (mVal?.messages) {
                try {
                  localStorage.setItem(`aerodrop_cached_msgs_${r.id}`, JSON.stringify(mVal.messages.slice(-100)));
                } catch (e) {}
              }
            })
            .catch(() => {});
        });
      }
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [token, currentUser]);

  // Fetch messages for active room (safe merge so real-time and optimistic messages are never lost)
  const fetchMessages = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedMsgs = data.messages || [];

        setMessages((prev) => {
          if (!loadedMsgs || loadedMsgs.length === 0) return prev;
          if (prev.length === 0) return loadedMsgs;

          // Deduplicate and merge by message ID / clientTempId
          const map = new Map();
          // 1. Keep all messages from previous state
          prev.forEach((m) => {
            const k = m.id || m.clientTempId;
            if (k) map.set(k, m);
          });

          // 2. Merge server-verified messages
          loadedMsgs.forEach((lm) => {
            if (lm.id) {
              const existing = map.get(lm.id) || {};
              map.set(lm.id, { ...existing, ...lm, status: 'sent' });

              // Also clear out optimistic temporary placeholder
              for (const [k, prevMsg] of map.entries()) {
                if (
                  prevMsg.clientTempId &&
                  (prevMsg.clientTempId === lm.clientTempId ||
                    (prevMsg.senderId === lm.senderId && prevMsg.text === (lm.text || lm.content)))
                ) {
                  map.delete(k);
                }
              }
            }
          });

          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          );
          return merged;
        });

        try {
          localStorage.setItem(`aerodrop_cached_msgs_${roomId}`, JSON.stringify(loadedMsgs.slice(-100)));
        } catch (e) {}
        markRead(roomId);
        // Clear unread count locally
        setRooms((prev) => {
          const updated = prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r));
          try {
            localStorage.setItem('aerodrop_cached_rooms', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [token, markRead]);

  // Active room change: load cached messages immediately, then fetch updates & join socket room
  useEffect(() => {
    if (activeRoomId) {
      try {
        localStorage.setItem('aerodrop_cached_active_room_id', activeRoomId);
        const cachedMsgs = localStorage.getItem(`aerodrop_cached_msgs_${activeRoomId}`);
        if (cachedMsgs) {
          setMessages(JSON.parse(cachedMsgs));
        }
      } catch (e) {}
      fetchMessages(activeRoomId);
      joinRoom(activeRoomId);
    }
  }, [activeRoomId, fetchMessages, joinRoom]);

  // Background interval: keep rooms and active messages in 100% continuous sync (passive 12s interval)
  useEffect(() => {
    if (!token) return;

    fetchRooms();

    const interval = setInterval(() => {
      fetchRooms();
      if (activeRoomIdRef.current) {
        fetchMessages(activeRoomIdRef.current);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [token, fetchRooms, fetchMessages]);

  const activeRoomIdRef = React.useRef(activeRoomId);
  const roomsRef = React.useRef(rooms);
  const fetchRoomsRef = React.useRef(fetchRooms);
  const markReadRef = React.useRef(markRead);
  const showToastRef = React.useRef(showToast);
  const currentUserRef = React.useRef(currentUser);
  const incomingCallRef = React.useRef(incomingCall);
  const activeCallRef = React.useRef(activeCall);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    fetchRoomsRef.current = fetchRooms;
  }, [fetchRooms]);

  useEffect(() => {
    markReadRef.current = markRead;
  }, [markRead]);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Real-time socket message listeners (stable, no endless re-binding or premature cleanup)
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (newMsg) => {
      if (!newMsg) return;
      const targetRoomId = newMsg.conversationId || newMsg.roomId;
      const currentActiveId = activeRoomIdRef.current;
      const currentUserId = currentUserRef.current?.id;

      // 1. Check if incoming message matches currently active chat ID
      if (targetRoomId && targetRoomId === currentActiveId) {
        // 2. Append new message to local messages state with deduplication & cache
        setMessages((prev) => {
          // If real message already confirmed and present, ignore duplicate socket event
          if (prev.some((m) => m.id === newMsg.id && !m.clientTempId)) {
            return prev;
          }

          let updated;
          const matchesOptimistic = prev.some(
            (m) =>
              (m.clientTempId && m.clientTempId === newMsg.clientTempId) ||
              (m.clientTempId && m.senderId === newMsg.senderId && m.text === (newMsg.text || newMsg.content))
          );

          if (matchesOptimistic) {
            updated = prev.map((m) =>
              (m.clientTempId && m.clientTempId === newMsg.clientTempId) ||
              (m.clientTempId && m.senderId === newMsg.senderId && m.text === (newMsg.text || newMsg.content))
                ? { ...newMsg, status: 'sent' }
                : m
            );
          } else {
            updated = [...prev, { ...newMsg, status: 'sent' }];
          }

          try {
            localStorage.setItem(`aerodrop_cached_msgs_${targetRoomId}`, JSON.stringify(updated.slice(-100)));
          } catch (e) {}
          return updated;
        });

        if (markReadRef.current) {
          markReadRef.current(targetRoomId);
        }
      } else {
        // 3. If it does not match (or matches another conversation), show toast notification
        if (newMsg.senderId !== currentUserId) {
          showToastRef.current?.({
            type: 'info',
            title: `New message from ${newMsg.senderName || 'Contact'}`,
            message: (newMsg.content || newMsg.text || 'Sent an attachment').slice(0, 60),
          });
        }

        // Cache for the target room so clicking it shows this message immediately
        try {
          const rawCached = localStorage.getItem(`aerodrop_cached_msgs_${targetRoomId}`);
          const existingList = rawCached ? JSON.parse(rawCached) : [];
          if (!existingList.some((m) => m.id === newMsg.id)) {
            const nextList = [...existingList, newMsg].slice(-100);
            localStorage.setItem(`aerodrop_cached_msgs_${targetRoomId}`, JSON.stringify(nextList));
          }
        } catch (e) {}
      }

      // 4. Update sidebar/conversations list state:
      // - latest message preview
      // - timestamp
      // - unread count badge
      // - re-sort so the most recently active conversation moves to the top
      setRooms((prev) => {
        const roomExists = prev.some((r) => r.id === targetRoomId);
        if (!roomExists) {
          fetchRoomsRef.current?.();
          return prev;
        }

        const updated = prev.map((r) => {
          if (r.id === targetRoomId) {
            const isCurrent = r.id === currentActiveId;
            return {
              ...r,
              unreadCount: isCurrent ? 0 : (r.unreadCount || 0) + 1,
              lastMessageText: newMsg.content || newMsg.text || (newMsg.attachmentRef ? '📎 File attached' : ''),
              lastMessageAt: newMsg.createdAt || new Date().toISOString(),
            };
          }
          return r;
        });

        // Re-sort so most recently active conversation moves to top
        return [...updated].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleRoomActivity = ({ roomId, conversationId, lastMessageAt, lastMessageText }) => {
      const targetId = roomId || conversationId;
      setRooms((prev) => {
        const roomExists = prev.some((r) => r.id === targetId);
        if (!roomExists) {
          fetchRoomsRef.current?.();
          return prev;
        }
        return prev
          .map((r) =>
            r.id === targetId ? { ...r, lastMessageAt, lastMessageText } : r
          )
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleMessagesRead = ({ roomId, conversationId, userId }) => {
      const targetId = roomId || conversationId;
      if (targetId === activeRoomIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            !m.readBy?.includes(userId)
              ? { ...m, readBy: [...(m.readBy || []), userId] }
              : m
          )
        );
      }
    };

    const handleRoomCreatedSocket = (newRoom) => {
      if (newRoom?.id) {
        setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
      }
      fetchRoomsRef.current?.();
    };

    // WebRTC Real-Time Call Signaling
    const handleIncomingCall = (payload) => {
      if (!payload) return;
      if (payload.callerId === currentUserRef.current?.id) return;

      // If user is already active in a call, decline with 'busy'
      if (activeCallRef.current?.isOpen) {
        socket.emit('call:decline', {
          callId: payload.callId,
          roomId: payload.roomId,
          callerId: payload.callerId,
          reason: 'busy',
        });
        return;
      }

      setIncomingCall(payload);
    };

    const handleCallEndedOrDeclined = (payload) => {
      if (incomingCallRef.current?.callId === payload?.callId) {
        setIncomingCall(null);
      }
    };

    socket.on('receive_message', handleIncomingMessage);
    socket.on('new_message', handleIncomingMessage);
    socket.on('room_activity', handleRoomActivity);
    socket.on('messages_read', handleMessagesRead);
    socket.on('room_created', handleRoomCreatedSocket);
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ended', handleCallEndedOrDeclined);
    socket.on('call:declined', handleCallEndedOrDeclined);

    return () => {
      socket.off('receive_message', handleIncomingMessage);
      socket.off('new_message', handleIncomingMessage);
      socket.off('room_activity', handleRoomActivity);
      socket.off('messages_read', handleMessagesRead);
      socket.off('room_created', handleRoomCreatedSocket);
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ended', handleCallEndedOrDeclined);
      socket.off('call:declined', handleCallEndedOrDeclined);
    };
  }, [socket]);

  const activeRoom =
    rooms.find((r) => r.id === activeRoomId) ||
    rooms.find((r) => r.type === 'group') ||
    rooms[0] ||
    DEFAULT_COMMUNITY_ROOM;

  const handleStartCall = useCallback(
    ({ type, room: targetRoom }) => {
      const roomToCall = targetRoom || activeRoom;
      setActiveCall({
        isOpen: true,
        callType: type === 'video' ? 'video' : 'voice',
        isInitiator: true,
        room: roomToCall,
      });
    },
    [activeRoom]
  );

  const handleAcceptIncomingCall = useCallback(() => {
    if (!incomingCallRef.current) return;
    const callData = incomingCallRef.current;
    setIncomingCall(null);

    const matchedRoom = roomsRef.current.find((r) => r.id === callData.roomId) || {
      id: callData.roomId,
      name: callData.callerName,
      displayTitle: callData.callerName,
      avatarColor: callData.callerColor,
      avatarInitials: (callData.callerName || 'U').slice(0, 2).toUpperCase(),
      type: 'direct',
    };

    setActiveCall({
      isOpen: true,
      callType: callData.callType === 'video' ? 'video' : 'voice',
      isInitiator: false,
      room: matchedRoom,
      incomingCall: callData,
    });
  }, []);

  const handleDeclineIncomingCall = useCallback(() => {
    if (!incomingCallRef.current) return;
    const callData = incomingCallRef.current;
    socket?.emit('call:decline', {
      callId: callData.callId,
      roomId: callData.roomId,
      callerId: callData.callerId,
      reason: 'declined',
    });
    setIncomingCall(null);
  }, [socket]);

  const handleCloseActiveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const handleSelectRoom = (roomId) => {
    setActiveRoomId(roomId);
    setMobileView('chat');
    try {
      localStorage.setItem('aerodrop_cached_active_room_id', roomId);
      const cachedMsgs = localStorage.getItem(`aerodrop_cached_msgs_${roomId}`);
      if (cachedMsgs) {
        setMessages(JSON.parse(cachedMsgs));
      }
    } catch (e) {}
  };

  const handleRoomCreated = (newRoom) => {
    if (newRoom?.id) {
      setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
      setActiveRoomId(newRoom.id);
      setMobileView('chat');
      joinRoom(newRoom.id);
    }
    fetchRooms();
  };

  // Unauthenticated Empty State
  if (!isAuthenticated) {
    return (
      <div
        className="animate-fade-up"
        style={{
          maxWidth: '560px',
          width: '100%',
          margin: '30px auto',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '48px 32px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
          }}
        >
          <MessageSquare size={32} />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
          Multi-User Real-Time Group Chat
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
          Connect with your team and recipients in real-time. Each user signs up with their own account, guaranteeing verified sender attribution on every message.
        </p>

        <button
          onClick={() => (onOpenAuth ? onOpenAuth() : setIsAuthOpen(true))}
          className="touch-target btn-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <LogIn size={16} />
          <span>Sign In or Create Account</span>
        </button>

        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-up chat-root-container"
      style={{
        width: '100%',
        height: 'calc(100dvh - 57px)',
        minHeight: '400px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '0',
        border: 'none',
        borderTop: '1px solid var(--border-subtle)',
        boxShadow: 'none',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left Pane: Conversation List */}
      <div
        style={{
          width: '320px',
          height: '100%',
          flexShrink: 0,
          display: mobileView === 'list' ? 'flex' : 'none',
        }}
        className="chat-list-pane"
      >
        <ConversationList
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onlineUserIds={onlineUserIds}
          loadingRooms={loadingRooms}
        />
      </div>

      {/* Right Pane: Active Conversation */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: mobileView === 'chat' ? 'flex' : 'none',
        }}
        className="chat-active-pane"
      >
        {activeRoom ? (
          <ActiveChat
            room={activeRoom}
            messages={messages}
            onSendMessage={sendMessage}
            onMessageSent={(sentMsg) => {
              if (sentMsg && (sentMsg.roomId === activeRoomId || sentMsg.conversationId === activeRoomId)) {
                setMessages((prev) => {
                  // If real message already confirmed, ignore
                  if (prev.some((m) => m.id === sentMsg.id && !m.clientTempId)) {
                    return prev;
                  }

                  // If updating an optimistic message
                  if (sentMsg.clientTempId && prev.some((m) => m.clientTempId === sentMsg.clientTempId)) {
                    const updated = prev.map((m) => (m.clientTempId === sentMsg.clientTempId ? sentMsg : m));
                    try {
                      localStorage.setItem(`aerodrop_cached_msgs_${activeRoomId}`, JSON.stringify(updated.slice(-100)));
                    } catch (e) {}
                    return updated;
                  }

                  // If adding an optimistic message for the first time
                  if (sentMsg.clientTempId && !prev.some((m) => m.id === sentMsg.id)) {
                    return [...prev, sentMsg];
                  }

                  if (prev.some((m) => m.id === sentMsg.id)) return prev;
                  const updated = [...prev, sentMsg];
                  try {
                    localStorage.setItem(`aerodrop_cached_msgs_${activeRoomId}`, JSON.stringify(updated.slice(-100)));
                  } catch (e) {}
                  return updated;
                });
                setRooms((prev) => {
                  const updatedRooms = prev
                    .map((r) =>
                      r.id === sentMsg.roomId
                        ? {
                            ...r,
                            lastMessageText: sentMsg.text || (sentMsg.attachmentRef ? '📎 File attached' : ''),
                            lastMessageAt: sentMsg.createdAt,
                          }
                        : r
                    )
                    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
                  try {
                    localStorage.setItem('aerodrop_cached_rooms', JSON.stringify(updatedRooms));
                  } catch (e) {}
                  return updatedRooms;
                });
              }
            }}
            onStartTyping={startTyping}
            onStopTyping={stopTyping}
            onOpenInfo={() => setIsInfoOpen(true)}
            onBackToList={() => setMobileView('list')}
            typingUsers={typingUsers}
            onlineUserIds={onlineUserIds}
            showToast={showToast}
            onStartCall={handleStartCall}
          />
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-placeholder)' }}>
            <Users size={36} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              Select a conversation
            </div>
            <div style={{ fontSize: '12px' }}>Choose a direct message or group chat from the left panel.</div>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onRoomCreated={handleRoomCreated}
        showToast={showToast}
      />

      <GroupInfoDrawer
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        room={activeRoom}
        onMemberUpdated={fetchRooms}
        showToast={showToast}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        showToast={showToast}
      />

      {/* WhatsApp-Style Incoming Call Alert */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      {/* End-to-End Real-Time WebRTC Call Interface */}
      {activeCall?.isOpen && (
        <CallModal
          isOpen={activeCall.isOpen}
          onClose={handleCloseActiveCall}
          room={activeCall.room}
          currentUser={currentUser}
          callType={activeCall.callType}
          isInitiator={activeCall.isInitiator}
          incomingCall={activeCall.incomingCall}
          socket={socket}
          onEndCallMessage={(text) => {
            if (activeCall.room?.id) {
              sendMessage(activeCall.room.id, text, null).then((msg) => {
                if (msg) {
                  setMessages((prev) => [...prev, { ...msg, status: 'sent' }]);
                }
              });
            }
          }}
        />
      )}

      {/* Responsive CSS for desktop two-pane layout */}
      <style>{`
        @media (min-width: 768px) {
          .chat-root-container {
            max-width: 1080px !important;
            margin: 20px auto !important;
            height: calc(100vh - 120px) !important;
            border-radius: 20px !important;
            border: 1px solid var(--border-subtle) !important;
            box-shadow: var(--shadow-card) !important;
          }
          .chat-list-pane {
            display: flex !important;
          }
          .chat-active-pane {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
