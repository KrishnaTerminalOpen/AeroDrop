import React, { useState, useEffect, useCallback } from 'react';
import ConversationList from './ConversationList';
import ActiveChat from './ActiveChat';
import NewChatModal from './NewChatModal';
import GroupInfoDrawer from './GroupInfoDrawer';
import AuthModal from './AuthModal';
import { useAuth } from '../../hooks/useAuth';
import { useChatSocket } from '../../hooks/useChatSocket';
import { MessageSquare, Users, Shield, LogIn } from 'lucide-react';

export default function ChatView({ showToast, onOpenAuth }) {
  const { currentUser, token, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Mobile layout state: 'list' | 'chat'
  const [mobileView, setMobileView] = useState('list');

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

  const activeRoomIdRef = React.useRef(activeRoomId);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Fetch rooms
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
        // Auto-select first room on desktop if none selected
        if (!activeRoomIdRef.current && loadedRooms.length > 0 && window.innerWidth >= 768) {
          setActiveRoomId(loadedRooms[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, [token]);

  // Fetch messages for active room
  const fetchMessages = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        markRead(roomId);
        // Clear unread count locally
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
        );
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [token, markRead]);

  // Active room change: load messages and join socket room
  useEffect(() => {
    if (activeRoomId) {
      fetchMessages(activeRoomId);
      joinRoom(activeRoomId);
    }
  }, [activeRoomId, fetchMessages, joinRoom]);

  // Background interval: keep rooms and active messages in 100% continuous sync
  useEffect(() => {
    if (!token) return;

    fetchRooms();

    const interval = setInterval(() => {
      fetchRooms();
      if (activeRoomIdRef.current) {
        fetchMessages(activeRoomIdRef.current);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token, fetchRooms, fetchMessages]);

  // Real-time socket message listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      const currentActiveId = activeRoomIdRef.current;
      if (newMsg.roomId === currentActiveId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        markRead(newMsg.roomId);
      } else {
        // Show in-app notification toast
        showToast({
          type: 'info',
          title: `New message from ${newMsg.senderName}`,
          message: newMsg.text?.slice(0, 60) || 'Sent an attachment',
        });
      }

      // Update rooms list in real-time
      setRooms((prev) => {
        const roomExists = prev.some((r) => r.id === newMsg.roomId);
        if (!roomExists) {
          fetchRooms();
          return prev;
        }

        return prev
          .map((r) =>
            r.id === newMsg.roomId
              ? {
                  ...r,
                  unreadCount: r.id === currentActiveId ? 0 : (r.unreadCount || 0) + 1,
                  lastMessageText: newMsg.text || (newMsg.attachmentRef ? '📎 File attached' : ''),
                  lastMessageAt: newMsg.createdAt,
                }
              : r
          )
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleRoomActivity = ({ roomId, lastMessageAt, lastMessageText }) => {
      setRooms((prev) => {
        const roomExists = prev.some((r) => r.id === roomId);
        if (!roomExists) {
          fetchRooms();
          return prev;
        }
        return prev
          .map((r) =>
            r.id === roomId ? { ...r, lastMessageAt, lastMessageText } : r
          )
          .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    };

    const handleMessagesRead = ({ roomId, userId }) => {
      if (roomId === activeRoomIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            !m.readBy.includes(userId)
              ? { ...m, readBy: [...m.readBy, userId] }
              : m
          )
        );
      }
    };

    const handleRoomCreatedSocket = (newRoom) => {
      if (newRoom?.id) {
        setRooms((prev) => [newRoom, ...prev.filter((r) => r.id !== newRoom.id)]);
        joinRoom(newRoom.id);
      }
      fetchRooms();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('room_activity', handleRoomActivity);
    socket.on('messages_read', handleMessagesRead);
    socket.on('room_created', handleRoomCreatedSocket);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('room_activity', handleRoomActivity);
      socket.off('messages_read', handleMessagesRead);
      socket.off('room_created', handleRoomCreatedSocket);
    };
  }, [socket, markRead, fetchRooms, joinRoom, showToast]);

  const handleSelectRoom = (roomId) => {
    setActiveRoomId(roomId);
    setMobileView('chat');
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

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

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
      className="animate-fade-up"
      style={{
        width: '100%',
        maxWidth: '1080px',
        height: 'calc(100vh - 160px)',
        minHeight: '540px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
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
              if (sentMsg && sentMsg.roomId === activeRoomId) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === sentMsg.id)) return prev;
                  return [...prev, sentMsg];
                });
                setRooms((prev) =>
                  prev
                    .map((r) =>
                      r.id === sentMsg.roomId
                        ? {
                            ...r,
                            lastMessageText: sentMsg.text || (sentMsg.attachmentRef ? '📎 File attached' : ''),
                            lastMessageAt: sentMsg.createdAt,
                          }
                        : r
                    )
                    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
                );
              }
            }}
            onStartTyping={startTyping}
            onStopTyping={stopTyping}
            onOpenInfo={() => setIsInfoOpen(true)}
            onBackToList={() => setMobileView('list')}
            typingUsers={typingUsers}
            onlineUserIds={onlineUserIds}
            showToast={showToast}
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

      {/* Responsive CSS for desktop two-pane layout */}
      <style>{`
        @media (min-width: 768px) {
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
