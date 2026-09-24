import React, { useState, useEffect } from 'react';
import { X, Users, User, Search, Plus, Check, MessageSquare } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function NewChatModal({ isOpen, onClose, onRoomCreated, showToast }) {
  const { token, currentUser } = useAuth();
  const [mode, setMode] = useState('direct'); // 'direct' | 'group'
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setUsers(d.users || []))
        .catch(console.error);
    }
  }, [isOpen, token]);

  if (!isOpen) return null;

  const toggleSelectUser = (userId) => {
    if (mode === 'direct') {
      // Start direct chat immediately
      handleCreateDirect(userId);
    } else {
      setSelectedUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreateDirect = async (targetUserId) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'direct', memberIds: [targetUserId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRoomCreated(data.room);
      onClose();
    } catch (err) {
      showToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      showToast({ type: 'error', title: 'Missing Name', message: 'Please enter a group name' });
      return;
    }
    if (selectedUserIds.length === 0) {
      showToast({ type: 'error', title: 'Missing Members', message: 'Select at least one member' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'group',
          name: groupName.trim(),
          memberIds: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast({ type: 'success', title: 'Group Created', message: `"${data.room.name}" is ready!` });
      onRoomCreated(data.room);
      onClose();
    } catch (err) {
      showToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeUp 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: 'var(--shadow-card)',
          padding: '26px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              New Conversation
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', margin: '2px 0 0 0' }}>
              Direct 1-on-1 message or multi-member group
            </p>
          </div>
          <button onClick={onClose} className="touch-target btn-press" style={{ background: 'transparent', border: 'none', color: 'var(--text-placeholder)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setMode('direct')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: mode === 'direct' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'direct' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: mode === 'direct' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <User size={15} />
            <span>Direct Message</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('group')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: mode === 'group' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'group' ? 'var(--text-main)' : 'var(--text-placeholder)',
              boxShadow: mode === 'group' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Users size={15} />
            <span>Group Chat</span>
          </button>
        </div>

        {/* Group Name input if in group mode */}
        {mode === 'group' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Design & Launch Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* User Search Input */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-placeholder)' }} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 12px 0 36px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Users List */}
        <div style={{ flex: 1, minHeight: '180px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '2px' }}>
          {filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-placeholder)', fontSize: '13px' }}>
              No other users found. Sign up a second account to test multi-user chat!
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleSelectUser(user.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        position: 'relative',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: user.color || '#6366f1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '13px',
                      }}
                    >
                      <span>{user.initials}</span>
                      {user.onlineStatus === 'online' && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            border: '2px solid var(--bg-card)',
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {user.displayName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                        {user.email}
                      </div>
                    </div>
                  </div>

                  {mode === 'group' && (
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                        backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </div>
                  )}

                  {mode === 'direct' && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                      Chat →
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Group Submit Button */}
        {mode === 'group' && (
          <button
            type="button"
            disabled={loading || selectedUserIds.length === 0 || !groupName.trim()}
            onClick={handleCreateGroup}
            className="touch-target btn-press"
            style={{
              marginTop: '16px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: selectedUserIds.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} />
            <span>Create Group ({selectedUserIds.length} members)</span>
          </button>
        )}
      </div>
    </div>
  );
}
