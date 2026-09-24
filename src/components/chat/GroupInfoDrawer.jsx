import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Trash2, Crown, Shield, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../utils/formatters';

export default function GroupInfoDrawer({
  isOpen,
  onClose,
  room,
  onMemberUpdated,
  showToast,
}) {
  const { currentUser, token } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [selectedNewUser, setSelectedNewUser] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = room?.members?.some(
    (m) => m.userId === currentUser?.id && m.role === 'admin'
  );

  useEffect(() => {
    if (isOpen && isAdmin && token) {
      fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => {
          const currentMemberIds = room?.memberIds || [];
          setAllUsers((d.users || []).filter((u) => !currentMemberIds.includes(u.id)));
        })
        .catch(console.error);
    }
  }, [isOpen, isAdmin, room?.memberIds, token]);

  if (!isOpen || !room) return null;

  const handleAddMember = async () => {
    if (!selectedNewUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newUserId: selectedNewUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast({ type: 'success', title: 'Member Added', message: 'New member can now chat with the group.' });
      setSelectedNewUser('');
      onMemberUpdated();
    } catch (err) {
      showToast({ type: 'error', title: 'Action Failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!window.confirm(`Are you sure you want to remove ${targetName} from the group?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${room.id}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast({ type: 'info', title: 'Member Removed', message: `${targetName} was removed from the group.` });
      onMemberUpdated();
    } catch (err) {
      showToast({ type: 'error', title: 'Action Failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '360px',
        maxWidth: '100%',
        backgroundColor: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeUp 200ms ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Group Details
          </h3>
        </div>
        <button
          onClick={onClose}
          className="touch-target btn-press"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-placeholder)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Group Hero */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              margin: '0 auto 12px auto',
              boxShadow: '0 6px 16px var(--accent-glow)',
            }}
          >
            {room.displayTitle.slice(0, 2).toUpperCase()}
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>
            {room.displayTitle}
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-placeholder)' }}>
            Created {formatDate(room.createdAt)}
          </div>
        </div>

        {/* Admin Section: Add Member */}
        {isAdmin && allUsers.length > 0 && (
          <div
            style={{
              marginBottom: '24px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              Add New Member
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedNewUser}
                onChange={(e) => setSelectedNewUser(e.target.value)}
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  padding: '0 8px',
                  outline: 'none',
                }}
              >
                <option value="">Select a platform user...</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedNewUser || loading}
                onClick={handleAddMember}
                className="touch-target btn-press"
                style={{
                  padding: '0 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: !selectedNewUser ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <UserPlus size={14} />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}

        {/* Member List */}
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-placeholder)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}
          >
            Members ({room.members?.length || 0})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {room.members?.map((member) => {
              const isMemberAdmin = member.role === 'admin';
              const canRemove = isAdmin && member.userId !== currentUser?.id;

              return (
                <div
                  key={member.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        position: 'relative',
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: member.color || '#6366f1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    >
                      <span>{member.initials}</span>
                      {member.onlineStatus === 'online' && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            border: '1.5px solid var(--bg-card)',
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {member.displayName}
                        </span>
                        {member.userId === currentUser?.id && (
                          <span style={{ fontSize: '10px', color: 'var(--text-placeholder)' }}>(You)</span>
                        )}
                        {isMemberAdmin && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              backgroundColor: 'var(--accent-subtle)',
                              color: 'var(--accent-primary)',
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: '999px',
                            }}
                          >
                            <Crown size={10} /> Admin
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                        Joined {formatDate(member.joinedAt)}
                      </div>
                    </div>
                  </div>

                  {canRemove && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.displayName)}
                      title="Remove member"
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
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-placeholder)')}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
