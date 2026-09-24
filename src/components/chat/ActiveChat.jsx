import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  ChevronDown,
  Info,
  ArrowLeft,
  FileText,
  Download,
  Users,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatBytes } from '../../utils/formatters';

const QUICK_EMOJIS = ['👍', '❤️', '🚀', '🔥', '🎉', '👏', '😊', '✅'];

export default function ActiveChat({
  room,
  messages,
  onSendMessage,
  onStartTyping,
  onStopTyping,
  onOpenInfo,
  onBackToList,
  typingUsers,
  onlineUserIds,
  showToast,
}) {
  const { currentUser, token } = useAuth();
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom on messages change
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    // Initial jump to bottom
    scrollToBottom(false);
  }, [room?.id]);

  useEffect(() => {
    // When messages arrive, if user is already near bottom, auto-scroll
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom(true);
    } else {
      setShowScrollBottom(true);
    }
  }, [messages]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollBottom(!isNearBottom);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    onStartTyping(room.id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping(room.id);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    setInputText('');
    onStopTyping(room.id);
    try {
      await onSendMessage(room.id, trimmed, null);
      scrollToBottom(true);
    } catch (err) {
      showToast({ type: 'error', title: 'Message Failed', message: err.message });
    }
  };

  // AeroDrop File Attachment handler
  const handleFileAttached = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingAttachment(true);
    showToast({ type: 'info', title: 'Uploading Attachment', message: 'Encrypting and packaging file for chat...' });

    try {
      const formData = new FormData();
      formData.append('recipientEmails', JSON.stringify([currentUser.email]));
      formData.append('senderEmail', currentUser.email);
      formData.append('subject', `Chat File: ${files[0].name}`);
      formData.append('description', `Attached in ${room.displayTitle}`);
      formData.append('expiryDays', '30');

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to attach file');
      const data = await res.json();

      const attachmentRef = {
        transferId: data.transfer.id,
        downloadUrl: data.transfer.downloadUrl,
        fileName: files.length === 1 ? files[0].name : `${files.length} Files Package`,
        fileSize: data.transfer.totalSize,
        isZip: files.length > 1,
      };

      await onSendMessage(room.id, `📎 Sent an attachment: ${attachmentRef.fileName}`, attachmentRef);
      scrollToBottom(true);
      showToast({ type: 'success', title: 'File Attached', message: 'Attachment shared with room members.' });
    } catch (err) {
      showToast({ type: 'error', title: 'Upload Failed', message: err.message });
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const activeTypingNames = Object.entries(typingUsers[room?.id] || {})
    .filter(([userId]) => userId !== currentUser?.id)
    .map(([, name]) => name);

  const isGroup = room?.type === 'group';

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-app)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileAttached}
        style={{ display: 'none' }}
      />

      {/* Chat Room Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Back button for mobile view */}
          <button
            onClick={onBackToList}
            className="touch-target btn-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <ArrowLeft size={18} />
          </button>

          {/* Avatar with assigned color & presence */}
          <div
            style={{
              position: 'relative',
              width: '38px',
              height: '38px',
              borderRadius: isGroup ? '10px' : '50%',
              backgroundColor: room.avatarColor || 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {isGroup ? <Users size={18} /> : <span>{room.avatarInitials}</span>}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {room.displayTitle}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', marginTop: '2px' }}>
              {isGroup
                ? `${room.members?.length || 0} members • Verified group attribution`
                : room.otherUser?.onlineStatus === 'online' || (room.otherUser && onlineUserIds.has(room.otherUser.id))
                ? 'Active now'
                : 'Offline'}
            </div>
          </div>
        </div>

        {/* Right Action: Group Info */}
        {isGroup && (
          <button
            onClick={onOpenInfo}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Info size={14} />
            <span>Group Info</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-placeholder)', maxWidth: '320px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Encrypted Real-Time Chat
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
              Messages are attributed to individual authenticated accounts and broadcast in real time via WebSockets.
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser?.id;
            const prevMsg = messages[idx - 1];

            // Check if consecutive from same sender within 2 minutes
            const isConsecutive =
              prevMsg &&
              prevMsg.senderId === msg.senderId &&
              Math.abs(new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 2 * 60 * 1000;

            // Delivery & Read receipt status
            const otherMembersCount = (room.memberIds?.length || 2) - 1;
            const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length;
            const isRead = readCount >= Math.max(1, otherMembersCount);
            const isDelivered = (msg.deliveredTo || []).length > 1;

            return (
              <div
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  marginTop: isConsecutive ? '2px' : '10px',
                }}
              >
                {/* Non-current user sender label with their assigned color in groups */}
                {!isMe && !isConsecutive && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                      marginLeft: '38px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: msg.senderColor || '#6366f1',
                      }}
                    >
                      {msg.senderName}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    maxWidth: '78%',
                  }}
                >
                  {/* Avatar beside bubble for incoming messages */}
                  {!isMe && (
                    <div style={{ width: '30px', flexShrink: 0 }}>
                      {!isConsecutive ? (
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: msg.senderColor || '#6366f1',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          {msg.senderInitials}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isMe
                        ? '16px 16px 4px 16px'
                        : '16px 16px 16px 4px',
                      backgroundColor: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                      color: isMe ? '#ffffff' : 'var(--text-main)',
                      border: isMe ? 'none' : '1px solid var(--border-subtle)',
                      boxShadow: 'var(--shadow-sm)',
                      fontSize: '14px',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                    }}
                  >
                    {/* Render Text */}
                    {msg.text && <div>{msg.text}</div>}

                    {/* Render File Attachment Card if attached */}
                    {msg.attachmentRef && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: isMe ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-card-subtle)',
                          border: `1px solid ${isMe ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <FileText size={18} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.attachmentRef.fileName}
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.85 }}>
                              {formatBytes(msg.attachmentRef.fileSize)}
                            </div>
                          </div>
                        </div>

                        <a
                          href={msg.attachmentRef.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: isMe ? '#ffffff' : 'var(--accent-primary)',
                            color: isMe ? 'var(--accent-primary)' : '#ffffff',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '11px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          <Download size={13} />
                          <span>Get</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timestamp & Read Receipt Icons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: 'var(--text-placeholder)',
                    marginTop: '3px',
                    marginLeft: isMe ? 0 : '38px',
                  }}
                >
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    <span title={isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent'}>
                      {isRead ? (
                        <CheckCheck size={13} color="var(--accent-primary)" />
                      ) : isDelivered ? (
                        <CheckCheck size={13} />
                      ) : (
                        <Check size={13} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Jump-to-Latest Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="touch-target btn-press"
          style={{
            position: 'absolute',
            bottom: '80px',
            right: '24px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '999px',
            padding: '8px 14px',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-main)',
            cursor: 'pointer',
            zIndex: 20,
          }}
        >
          <ChevronDown size={14} />
          <span>Latest Messages</span>
        </button>
      )}

      {/* Typing Indicator Bar */}
      {activeTypingNames.length > 0 && (
        <div
          style={{
            padding: '4px 24px',
            fontSize: '12px',
            color: 'var(--accent-primary)',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
          }}
        >
          <div style={{ display: 'flex', gap: '3px' }}>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', animation: 'bounceSubtle 1s infinite' }} />
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', animation: 'bounceSubtle 1s infinite 200ms' }} />
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', animation: 'bounceSubtle 1s infinite 400ms' }} />
          </div>
          <span>
            {activeTypingNames.length === 1
              ? `${activeTypingNames[0]} is typing...`
              : `${activeTypingNames.join(', ')} are typing...`}
          </span>
        </div>
      )}

      {/* Emoji Picker Popup Bar */}
      {showEmojiPicker && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setInputText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              style={{
                fontSize: '18px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '6px',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Bar */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Attachment Button (AeroDrop File Transfer integration) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAttachment}
          title="Attach files via AeroDrop"
          className="touch-target btn-press"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isUploadingAttachment ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          {isUploadingAttachment ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Paperclip size={16} />
          )}
        </button>

        {/* Emoji Toggle */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          title="Insert emoji"
          className="touch-target btn-press"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Smile size={16} />
        </button>

        {/* Input Field */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${room.displayTitle}...`}
          style={{
            flex: 1,
            height: '42px',
            padding: '0 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '14px',
            outline: 'none',
          }}
        />

        {/* Send Button */}
        <button
          type="button"
          disabled={!inputText.trim()}
          onClick={handleSend}
          className="touch-target btn-press"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: inputText.trim() ? 'var(--accent-primary)' : 'var(--bg-card-subtle)',
            color: inputText.trim() ? '#ffffff' : 'var(--text-placeholder)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: inputText.trim() ? 'pointer' : 'not-allowed',
            boxShadow: inputText.trim() ? '0 4px 12px var(--accent-glow)' : 'none',
            flexShrink: 0,
            transition: 'all 150ms ease',
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
