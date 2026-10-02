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

export function mergeAndDeduplicateMessages(currentList = [], incoming = []) {
  const incomingList = Array.isArray(incoming) ? incoming : [incoming];
  if (!incomingList.length) return currentList;

  let list = [...currentList];

  for (const item of incomingList) {
    if (!item) continue;
    const isIncomingTemp = item.id?.startsWith('temp_') || (item.clientTempId && !item.id?.startsWith('m_'));

    if (isIncomingTemp) {
      const alreadyExists = list.some(
        (m) => m.id === item.id || (item.clientTempId && m.clientTempId === item.clientTempId)
      );
      if (!alreadyExists) {
        list.push(item);
      }
    } else {
      // Confirmed server message
      const existingServerIdx = list.findIndex((m) => m.id === item.id);
      if (existingServerIdx !== -1) {
        list[existingServerIdx] = { ...list[existingServerIdx], ...item, status: 'sent' };
        continue;
      }

      // Reconcile and drop any matching temporary optimistic placeholder
      let matchedTempIdx = -1;
      if (item.clientTempId) {
        matchedTempIdx = list.findIndex(
          (m) =>
            (m.id?.startsWith('temp_') || m.clientTempId) &&
            (m.id === item.clientTempId || m.clientTempId === item.clientTempId)
        );
      }

      if (matchedTempIdx === -1 && item.senderId) {
        matchedTempIdx = list.findIndex((m) => {
          if (!m.id?.startsWith('temp_') && !m.clientTempId) return false;
          if (m.senderId !== item.senderId) return false;
          const timeDiff = Math.abs(new Date(item.createdAt || 0) - new Date(m.createdAt || 0));
          return timeDiff < 25000;
        });
      }

      if (matchedTempIdx !== -1) {
        list.splice(matchedTempIdx, 1, { ...item, status: 'sent' });
      } else {
        list.push({ ...item, status: 'sent' });
      }
    }
  }

  // Deduplicate strictly
  const seenRealIds = new Set();
  const seenTempIds = new Set();
  const now = Date.now();
  const result = [];

  for (const m of list) {
    if (!m || !m.id) continue;
    const isTemp = m.id.startsWith('temp_') || (!m.id.startsWith('m_') && m.clientTempId);

    if (isTemp) {
      const age = now - new Date(m.createdAt || 0).getTime();
      if (age > 25000) continue; // Prune expired temp messages

      const tKey = m.clientTempId || m.id;
      if (seenTempIds.has(tKey)) continue;
      seenTempIds.add(tKey);
      result.push(m);
    } else {
      if (seenRealIds.has(m.id)) continue;
      seenRealIds.add(m.id);
      result.push(m);
    }
  }

  return result.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

export default function ChatView({ showToast, onOpenAuth, initiallyOpenNewChat = false, isActive = true }) {
  const { currentUser, token, isAuthenticated } = useAuth();

  // Instant Zero-Delay State Layer: initialized directly so group chat displays with ZERO delay
  const [rooms, setRooms] = useState(() => {
    try {
      const cached = localStorage.getItem('aerodrop_cached_rooms');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.filter((r) => {
            if (r.type === 'direct') {
              const text = r.lastMessageText?.trim();
              return text && text !== 'Conversation started' && text !== 'No messages yet';
            }
            return true;
          });
          return sanitized.length > 0 ? sanitized : [DEFAULT_COMMUNITY_ROOM];
        }
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

  // Pending 1-on-1 direct room (opened from search/modal, but not yet shown in main sidebar until first message is sent)
  const [pendingDirectRoom, setPendingDirectRoom] = useState(null);

  // Modals & Calls
  const [isNewChatOpen, setIsNewChatOpen] = useState(initiallyOpenNewChat);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  // WhatsApp-style: phones start on the conversation list; tap a contact to open the thread
  const [mobileView, setMobileView] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'list' : 'chat'
  );

  useEffect(() => {
    if (!isActive) return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) setMobileView('list');
  }, [isActive]);

  // Socket Hook
  const {
    socket,
    isConnected,
    onlineUserIds,
    typingUsers,
    joinRoom,
    sendMessage,
    deleteMessage,
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
        const rawRooms = data.rooms || [];
        const loadedRooms = rawRooms.filter((r) => {
          if (r.type === 'direct') {
            const text = r.lastMessageText?.trim();
            return text && text !== 'Conversation started' && text !== 'No messages yet';
          }
          return true;
        });
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

  // Fetch messages for active room (safe merge strictly isolated to target roomId)
  const fetchMessages = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedMsgs = data.messages || [];

        // Guard: ensure this response is strictly for the room that is currently active
        if (activeRoomIdRef.current !== roomId) return;

        setMessages((prev) => {
          const roomPrev = prev.filter(
            (m) => m.roomId === roomId || m.conversationId === roomId
          );
          return mergeAndDeduplicateMessages(roomPrev, loadedMsgs);
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

  // Active room change: load cached messages immediately (or clear immediately), then fetch updates & join socket room
  useEffect(() => {
    if (activeRoomId) {
      try {
        localStorage.setItem('aerodrop_cached_active_room_id', activeRoomId);
        const cachedMsgs = localStorage.getItem(`aerodrop_cached_msgs_${activeRoomId}`);
        if (cachedMsgs) {
          const parsed = JSON.parse(cachedMsgs);
          setMessages(Array.isArray(parsed) ? parsed : []);
        } else {
          setMessages([]);
        }
      } catch (e) {
        setMessages([]);
      }
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
        // 2. Append new message to local messages state with strict deduplication & cache
        setMessages((prev) => {
          const merged = mergeAndDeduplicateMessages(prev, newMsg);
          try {
            localStorage.setItem(`aerodrop_cached_msgs_${targetRoomId}`, JSON.stringify(merged.slice(-100)));
          } catch (e) {}
          return merged;
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

    const handleMessageDeleted = ({ roomId, conversationId, messageId }) => {
      const targetId = roomId || conversationId;
      if (targetId === activeRoomIdRef.current) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== messageId && m.clientTempId !== messageId);
          try {
            localStorage.setItem(`aerodrop_cached_msgs_${targetId}`, JSON.stringify(filtered.slice(-100)));
          } catch (e) {}
          return filtered;
        });
      }
      fetchRoomsRef.current?.();
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
      if (newRoom?.id && newRoom.type === 'group') {
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
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('room_activity', handleRoomActivity);
    socket.on('messages_read', handleMessagesRead);
    socket.on('room_created', handleRoomCreatedSocket);
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ended', handleCallEndedOrDeclined);
    socket.on('call:declined', handleCallEndedOrDeclined);

    return () => {
      socket.off('receive_message', handleIncomingMessage);
      socket.off('new_message', handleIncomingMessage);
      socket.off('message_deleted', handleMessageDeleted);
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
    (pendingDirectRoom && pendingDirectRoom.id === activeRoomId ? pendingDirectRoom : null) ||
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
        const parsed = JSON.parse(cachedMsgs);
        setMessages(Array.isArray(parsed) ? parsed : []);
      } else {
        setMessages([]);
      }
    } catch (e) {
      setMessages([]);
    }
  };

  const handleRoomCreated = (newRoom) => {
    if (newRoom?.id) {
      if (newRoom.type === 'group') {
        setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
      } else {
        // Direct conversation: hold as pending active room so it does not clutter the sidebar until first interaction
        setPendingDirectRoom(newRoom);
      }
      setActiveRoomId(newRoom.id);
      setMessages([]);
      try {
        localStorage.removeItem(`aerodrop_cached_msgs_${newRoom.id}`);
      } catch (e) {}
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
        height: '100%',
        minHeight: 0,
        flex: 1,
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
                  const merged = mergeAndDeduplicateMessages(prev, sentMsg);
                  try {
                    localStorage.setItem(`aerodrop_cached_msgs_${activeRoomId}`, JSON.stringify(merged.slice(-100)));
                  } catch (e) {}
                  return merged;
                });

                // If this is a pending direct room receiving its first message, promote it to sidebar rooms list
                if (pendingDirectRoom && pendingDirectRoom.id === activeRoomId) {
                  const promotedRoom = {
                    ...pendingDirectRoom,
                    lastMessageText: sentMsg.text || (sentMsg.attachmentRef ? '📎 File attached' : ''),
                    lastMessageAt: sentMsg.createdAt || new Date().toISOString(),
                  };
                  setRooms((prev) => [promotedRoom, ...prev.filter((r) => r.id !== promotedRoom.id)]);
                  setPendingDirectRoom(null);
                } else {
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
              }
            }}
            onDeleteMessage={async (targetRoomId, messageId) => {
              // Optimistic deletion from local state and cache
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.id !== messageId && m.clientTempId !== messageId);
                try {
                  localStorage.setItem(`aerodrop_cached_msgs_${targetRoomId}`, JSON.stringify(filtered.slice(-100)));
                } catch (e) {}
                return filtered;
              });

              try {
                await deleteMessage(targetRoomId, messageId);
                showToast?.({
                  type: 'success',
                  title: 'Message Deleted',
                  message: 'The message was deleted for everyone.',
                });
                fetchRooms();
              } catch (err) {
                console.error('Failed to delete message:', err);
                showToast?.({
                  type: 'error',
                  title: 'Delete Failed',
                  message: err.message || 'Could not delete message.',
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
                  setMessages((prev) => mergeAndDeduplicateMessages(prev, msg));
                }
              });
            }
          }}
        />
      )}

      {/* Responsive CSS for desktop, laptop, tablet, and mobile layout */}
      <style>{`
        @media (max-width: 767px) {
          .chat-root-container {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .chat-list-pane {
            width: 100% !important;
            max-width: 100% !important;
            flex: 1 !important;
            display: ${mobileView === 'list' ? 'flex' : 'none'} !important;
          }
          .chat-active-pane {
            width: 100% !important;
            max-width: 100% !important;
            flex: 1 !important;
            display: ${mobileView === 'chat' ? 'flex' : 'none'} !important;
          }
          .chat-mobile-back-btn {
            display: flex !important;
          }
        }
        @media (min-width: 768px) {
          .chat-root-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            height: 100% !important;
            border-radius: 0 !important;
            border: none !important;
            border-top: 1px solid var(--border-subtle) !important;
            box-shadow: none !important;
          }
          .chat-list-pane {
            display: flex !important;
            width: clamp(300px, 26vw, 380px) !important;
            flex-shrink: 0 !important;
            border-right: 1px solid var(--border-subtle) !important;
          }
          .chat-active-pane {
            display: flex !important;
            flex: 1 !important;
            min-width: 0 !important;
          }
          .chat-mobile-back-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
