import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Users, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function ConversationList({
  rooms,
  activeRoomId,
  onSelectRoom,
  onOpenNewChat,
  onOpenAuth,
  onlineUserIds,
}) {
  const { currentUser, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.displayTitle?.toLowerCase().includes(q) ||
      r.lastMessageText?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header & New Chat Button */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Messages
          </h2>
        </div>

        <button
          onClick={onOpenNewChat}
          className="touch-target btn-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-placeholder)' }} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '36px',
              padding: '0 10px 0 32px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Conversation Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {filteredRooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-placeholder)', fontSize: '13px' }}>
            <MessageSquare size={28} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              No chats found
            </div>
            <div>Click "+ New Chat" to start a direct message or create a group chat.</div>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            const isGroup = room.type === 'group';
            const otherUserId = !isGroup && room.otherUser?.id;
            const isOtherOnline = otherUserId && onlineUserIds.has(otherUserId);

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--accent-border)' : 'transparent'}`,
                  transition: 'background-color 150ms ease',
                }}
              >
                {/* Avatar with assigned color & presence dot */}
                <div
                  style={{
                    position: 'relative',
                    width: '42px',
                    height: '42px',
                    borderRadius: isGroup ? '12px' : '50%',
                    backgroundColor: room.avatarColor || 'var(--accent-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {isGroup ? <Users size={18} /> : <span>{room.avatarInitials}</span>}

                  {/* Presence indicator */}
                  {!isGroup && isOtherOnline && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '11px',
                        height: '11px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        border: '2px solid var(--bg-card)',
                      }}
                    />
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: room.unreadCount > 0 ? 700 : 600,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {room.displayTitle}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-placeholder)', flexShrink: 0, marginLeft: '6px' }}>
                      {formatTime(room.lastMessageAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: room.unreadCount > 0 ? 'var(--text-main)' : 'var(--text-placeholder)',
                        fontWeight: room.unreadCount > 0 ? 600 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {room.lastMessageText || 'No messages yet'}
                    </span>

                    {/* Unread count badge */}
                    {room.unreadCount > 0 && (
                      <span
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '999px',
                          padding: '2px 7px',
                          marginLeft: '6px',
                          flexShrink: 0,
                        }}
                      >
                        {room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Authenticated User Status Footer Bar */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {currentUser ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: currentUser.color || '#4f46e5',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                {currentUser.initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser.displayName}
                </div>
                <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  Online
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign out or switch accounts"
              className="touch-target btn-press"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-placeholder)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-placeholder)')}
            >
              <LogOut size={14} />
              <span>Switch</span>
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAuth}
            className="touch-target btn-press"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In / Register
          </button>
        )}
      </div>
    </div>
  );
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffHours = (now - d) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
