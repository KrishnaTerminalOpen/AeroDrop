import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
  Info,
  ArrowLeft,
  FileText,
  Download,
  Users,
  ShieldCheck,
  Loader2,
  Phone,
  Video,
  Camera,
  X,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatBytes } from '../../utils/formatters';
import CameraModal from './CameraModal';

const QUICK_EMOJIS = ['👍', '❤️', '🚀', '🔥', '🎉', '👏', '😊', '✅', '🙏', '💯'];

export default function ActiveChat({
  room,
  messages,
  onSendMessage,
  onMessageSent,
  onStartTyping,
  onStopTyping,
  onOpenInfo,
  onBackToList,
  typingUsers,
  onlineUserIds,
  showToast,
  onStartCall,
}) {
  const { currentUser, token } = useAuth();
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Camera Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // WhatsApp-style Fullscreen Photo Lightbox
  const [selectedLightboxImage, setSelectedLightboxImage] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedLightboxImage) {
        setSelectedLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLightboxImage]);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const prevMsgCountRef = useRef(messages?.length || 0);

  // Smooth scroll to bottom helper using requestAnimationFrame
  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    });
  };

  // Jump to bottom immediately on room switch
  useEffect(() => {
    isNearBottomRef.current = true;
    scrollToBottom(false);
    prevMsgCountRef.current = messages?.length || 0;
  }, [room?.id]);

  // Smart auto-scroll when new messages arrive (without jerking scroll if user scrolled up)
  useEffect(() => {
    const currentCount = messages?.length || 0;
    const isNewMessage = currentCount > prevMsgCountRef.current;
    prevMsgCountRef.current = currentCount;

    if (!isNewMessage) return;

    const lastMsg = messages[messages.length - 1];
    const isSentByMe = lastMsg?.senderId === currentUser?.id;

    // Always scroll if sent by me, or if user is already near bottom
    if (isSentByMe || isNearBottomRef.current) {
      scrollToBottom(true);
    } else {
      setShowScrollBottom(true);
    }
  }, [messages, currentUser?.id]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceToBottom < 90;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  };

  // Throttled typing indicator (broadcasts at most once per 2.5s)
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2500) {
      lastTypingEmitRef.current = now;
      onStartTyping?.(room.id);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping?.(room.id);
      lastTypingEmitRef.current = 0;
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // WhatsApp-grade instant optimistic send
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // 1. Immediately clear input & reset typing state
    setInputText('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onStopTyping?.(room.id);
    lastTypingEmitRef.current = 0;

    // 2. Generate optimistic client ID & message object (instantly marked as sent unless offline)
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      clientTempId: tempId,
      roomId: room.id,
      conversationId: room.id,
      senderId: currentUser?.id,
      senderName: currentUser?.displayName || 'You',
      senderInitials: (currentUser?.displayName || 'You').slice(0, 2).toUpperCase(),
      senderColor: currentUser?.color || '#4f46e5',
      text: trimmed,
      content: trimmed,
      attachmentRef: null,
      createdAt: new Date().toISOString(),
      status: isOffline ? 'sending' : 'sent',
      deliveredTo: [currentUser?.id],
      readBy: [currentUser?.id],
    };

    // 3. Immediately render in UI
    onMessageSent?.(optimisticMsg);

    // 4. Smooth scroll to bottom immediately
    isNearBottomRef.current = true;
    scrollToBottom(true);

    // 5. Keep input focused
    inputRef.current?.focus();

    // 6. Background network dispatch
    try {
      const sentMsg = await onSendMessage(room.id, trimmed, null);
      if (sentMsg && onMessageSent) {
        onMessageSent({ ...sentMsg, clientTempId: tempId, status: 'sent' });
      }
    } catch (err) {
      console.error('[ActiveChat] Send error:', err);
      showToast?.({ type: 'error', title: 'Message Failed', message: err.message });
    }
  };

  // Helper to read file as base64 data URL for zero-latency instant preview
  const readFileAsDataUrl = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  // File Attachment handler (via AeroDrop unlimited storage)
  const handleFileAttached = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isSingle = files.length === 1;
    const isImg =
      isSingle &&
      (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.name));
    const isVid =
      isSingle &&
      (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg)$/i.test(file.name));

    setIsUploadingAttachment(true);
    showToast?.({
      type: 'info',
      title: isImg ? 'Sending Photo' : isVid ? 'Sending Video' : 'Uploading Attachment',
      message: 'Packaging and sending media...',
    });

    // Local data URL for zero-lag instant preview
    let localDataUrl = null;
    let localBlobUrl = null;
    if (isSingle && (isImg || isVid)) {
      try {
        localBlobUrl = URL.createObjectURL(file);
      } catch (err) {}
      if (file.size < 12 * 1024 * 1024) {
        try {
          localDataUrl = await readFileAsDataUrl(file);
        } catch (err) {}
      }
    }

    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const tempId = `temp_file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (isSingle && (isImg || isVid) && (localDataUrl || localBlobUrl)) {
      const optimisticMsg = {
        id: tempId,
        clientTempId: tempId,
        roomId: room.id,
        conversationId: room.id,
        senderId: currentUser?.id,
        senderName: currentUser?.displayName || 'You',
        senderInitials: (currentUser?.displayName || 'You').slice(0, 2).toUpperCase(),
        senderColor: currentUser?.color || '#4f46e5',
        text: '',
        content: '',
        attachmentRef: {
          downloadUrl: localDataUrl || localBlobUrl,
          storageUrl: localDataUrl || localBlobUrl,
          dataUrl: localDataUrl || null,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          isImage: isImg,
          isVideo: isVid,
          isZip: false,
        },
        createdAt: new Date().toISOString(),
        status: isOffline ? 'sending' : 'sent',
        deliveredTo: [currentUser?.id],
        readBy: [currentUser?.id],
      };
      onMessageSent?.(optimisticMsg);
      isNearBottomRef.current = true;
      scrollToBottom(true);
    }

    try {
      const formData = new FormData();
      const memberEmails = (room?.members || []).map((m) => m.email).filter(Boolean);
      const recipientList =
        memberEmails.length > 0 ? memberEmails : [currentUser?.email || 'chat@aerodrop.local'];

      formData.append('recipientEmails', JSON.stringify(recipientList));
      formData.append('senderEmail', currentUser?.email || 'chat@aerodrop.local');
      formData.append('subject', `${isImg ? 'Photo' : isVid ? 'Video' : 'File'}: ${files[0].name}`);
      formData.append('description', `Sent in ${room?.displayTitle || room?.name || 'Chat'}`);
      formData.append('expiryDays', '30');
      formData.append('skipEmail', 'true');

      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (res.status === 401 && headers['Authorization']) {
        res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to attach file');
      }
      const data = await res.json();

      const firstFile = data.transfer?.files?.[0];
      const directUrl =
        firstFile?.storageUrl || firstFile?.directUrl || data.transfer?.directDownloadUrl;
      const downloadUrl = directUrl || data.transfer.downloadUrl;

      const attachmentRef = {
        transferId: data.transfer.id,
        downloadUrl,
        storageUrl: directUrl || localDataUrl || null,
        dataUrl: localDataUrl || firstFile?.dataUrl || null,
        directUrl: firstFile?.directUrl || null,
        fileName: files.length === 1 ? files[0].name : `${files.length} Files Package`,
        fileSize: data.transfer.totalSize,
        mimeType: files[0].type || 'application/octet-stream',
        isImage: isImg,
        isVideo: isVid,
        isZip: files.length > 1,
      };

      const msgText = isImg || isVid ? '' : `📎 Sent an attachment: ${attachmentRef.fileName}`;
      const sentMsg = await onSendMessage(room.id, msgText, attachmentRef);
      if (sentMsg && onMessageSent) {
        onMessageSent({ ...sentMsg, clientTempId: tempId, status: 'sent' });
      }
      isNearBottomRef.current = true;
      scrollToBottom(true);
      showToast?.({
        type: 'success',
        title: isImg ? 'Photo Sent' : isVid ? 'Video Sent' : 'File Attached',
        message: 'Shared successfully.',
      });
    } catch (err) {
      console.error('File attachment upload error:', err);
      showToast?.({ type: 'error', title: 'Upload Failed', message: err.message });
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  // WhatsApp-style camera photo captured & sent
  const handleCameraPhotoSent = async (file, captionText, capturedDataUrl) => {
    setIsUploadingAttachment(true);
    showToast?.({ type: 'info', title: 'Sending Photo', message: 'Uploading camera snapshot...' });

    const dataUrl = capturedDataUrl || null;
    const tempId = `temp_photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Instant optimistic render so photo shows in chat immediately with zero lag!
    const optimisticAttachment = {
      downloadUrl: dataUrl,
      storageUrl: dataUrl,
      dataUrl: dataUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'image/jpeg',
      isImage: true,
      isVideo: false,
      isZip: false,
    };
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const optimisticMsg = {
      id: tempId,
      clientTempId: tempId,
      roomId: room.id,
      conversationId: room.id,
      senderId: currentUser?.id,
      senderName: currentUser?.displayName || 'You',
      senderInitials: (currentUser?.displayName || 'You').slice(0, 2).toUpperCase(),
      senderColor: currentUser?.color || '#4f46e5',
      text: captionText || '',
      content: captionText || '',
      attachmentRef: optimisticAttachment,
      createdAt: new Date().toISOString(),
      status: isOffline ? 'sending' : 'sent',
      deliveredTo: [currentUser?.id],
      readBy: [currentUser?.id],
    };
    onMessageSent?.(optimisticMsg);
    isNearBottomRef.current = true;
    scrollToBottom(true);

    try {
      const formData = new FormData();
      const memberEmails = (room?.members || []).map((m) => m.email).filter(Boolean);
      const recipientList =
        memberEmails.length > 0 ? memberEmails : [currentUser?.email || 'chat@aerodrop.local'];

      formData.append('recipientEmails', JSON.stringify(recipientList));
      formData.append('senderEmail', currentUser?.email || 'chat@aerodrop.local');
      formData.append('subject', `Photo: ${file.name}`);
      formData.append('description', captionText || `Photo in ${room?.displayTitle || 'Chat'}`);
      formData.append('expiryDays', '30');
      formData.append('skipEmail', 'true');
      formData.append('files', file);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch('/api/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to upload photo');
      }

      const data = await res.json();
      const firstFile = data.transfer?.files?.[0];
      const directUrl =
        firstFile?.storageUrl || firstFile?.directUrl || data.transfer?.directDownloadUrl;
      const downloadUrl = directUrl || data.transfer.downloadUrl;

      const attachmentRef = {
        transferId: data.transfer.id,
        downloadUrl,
        storageUrl: directUrl || dataUrl || null,
        dataUrl: dataUrl || firstFile?.dataUrl || null,
        directUrl: firstFile?.directUrl || null,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'image/jpeg',
        isImage: true,
        isVideo: false,
        isZip: false,
      };

      const sentMsg = await onSendMessage(room.id, captionText || '', attachmentRef);
      if (sentMsg && onMessageSent) {
        onMessageSent({ ...sentMsg, clientTempId: tempId, status: 'sent' });
      }
      isNearBottomRef.current = true;
      scrollToBottom(true);
      showToast?.({ type: 'success', title: 'Photo Sent', message: 'Photo shared successfully.' });
    } catch (err) {
      console.error('Camera photo error:', err);
      showToast?.({ type: 'error', title: 'Photo Failed', message: err.message });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Launch Voice Call
  const handleStartVoiceCall = () => {
    if (onStartCall) {
      onStartCall({ type: 'audio', room });
    }
  };

  // Launch Video Call
  const handleStartVideoCall = () => {
    if (onStartCall) {
      onStartCall({ type: 'video', room });
    }
  };

  const handleEndCallMessage = (text) => {
    onSendMessage?.(room.id, text, null).then((msg) => {
      if (msg && onMessageSent) onMessageSent(msg);
    });
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
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Back button for mobile */}
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
              width: '40px',
              height: '40px',
              borderRadius: isGroup ? '12px' : '50%',
              backgroundColor: room.avatarColor || 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: 'var(--shadow-sm)',
              flexShrink: 0,
            }}
          >
            {isGroup ? <Users size={20} /> : <span>{room.avatarInitials}</span>}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {room.displayTitle}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', marginTop: '2px' }}>
              {isGroup
                ? `${room.members?.length || 0} members • Verified group chat`
                : (() => {
                    const otherUserId =
                      room.otherUser?.id ||
                      room.otherUser?._id ||
                      room.members?.find((m) => (m.id || m.userId) !== currentUser?.id)?.id;
                    const isOnline =
                      room.otherUser?.onlineStatus === 'online' ||
                      (otherUserId &&
                        ((onlineUserIds instanceof Set && onlineUserIds.has(otherUserId)) ||
                          (Array.isArray(onlineUserIds) && onlineUserIds.includes(otherUserId)) ||
                          (typeof onlineUserIds?.has === 'function' && onlineUserIds.has(otherUserId))));
                    return isOnline ? 'Active now' : 'Offline';
                  })()}
            </div>
          </div>
        </div>

        {/* Header Action Buttons: Voice Call, Video Call, Group Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Voice Call Button */}
          <button
            type="button"
            onClick={handleStartVoiceCall}
            className="touch-target btn-press"
            title="Start Voice Call"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <Phone size={17} />
          </button>

          {/* Video Call Button */}
          <button
            type="button"
            onClick={handleStartVideoCall}
            className="touch-target btn-press"
            title="Start Video Call"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <Video size={18} />
          </button>

          {/* Group Info Drawer Toggle */}
          {isGroup && (
            <button
              onClick={onOpenInfo}
              className="touch-target btn-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Info size={15} />
              <span>Info</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-scroll-smooth"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px', // Tight WhatsApp-style consecutive spacing
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-placeholder)', maxWidth: '320px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              <ShieldCheck size={28} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
              Encrypted Real-Time Chat
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
              Messages and calls are end-to-end encrypted with zero size restrictions on shared files.
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser?.id;
            const prevMsg = messages[idx - 1];

            // Date separator (like WhatsApp)
            const showDateSeparator =
              !prevMsg ||
              new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

            const isConsecutive =
              prevMsg &&
              prevMsg.senderId === msg.senderId &&
              !showDateSeparator &&
              Math.abs(new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 2 * 60 * 1000;

            const otherMembersCount = (room.memberIds?.length || 2) - 1;
            const readCount = (msg.readBy || []).filter((id) => id !== msg.senderId).length;
            const isRead = readCount >= Math.max(1, otherMembersCount);
            const isDelivered = (msg.deliveredTo || []).length > 1;

            return (
              <React.Fragment key={msg.id || msg.clientTempId || idx}>
                {/* Date separator pill */}
                {showDateSeparator && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '16px 0 10px 0',
                    }}
                  >
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-placeholder)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {new Date(msg.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: new Date().getFullYear() !== new Date(msg.createdAt).getFullYear() ? 'numeric' : undefined,
                      })}
                    </div>
                  </div>
                )}

                <div
                  className="chat-bubble-animated"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    marginTop: isConsecutive ? '2px' : '10px',
                  }}
                >
                  {/* Sender label with assigned color in groups */}
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
                        {msg.senderName || 'Contact'}
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
                            {msg.senderInitials || (msg.senderName ? msg.senderName.slice(0, 2).toUpperCase() : 'U')}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* WhatsApp-Style Message Bubble */}
                    {(() => {
                      const attachment =
                        typeof msg.attachmentRef === 'string'
                          ? (() => {
                              try {
                                return JSON.parse(msg.attachmentRef);
                              } catch (e) {
                                return null;
                              }
                            })()
                          : msg.attachmentRef;

                      const isImage =
                        attachment &&
                        (attachment.isImage === true ||
                          attachment.mimeType?.startsWith('image/') ||
                          /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(attachment.fileName || ''));

                      const isVideo =
                        attachment &&
                        (attachment.isVideo === true ||
                          attachment.mimeType?.startsWith('video/') ||
                          /\.(mp4|webm|mov|m4v|ogg)$/i.test(attachment.fileName || ''));

                      const isMedia = isImage || isVideo;

                      // Resolve direct inline media URL
                      const getInlineMediaUrl = (att) => {
                        if (!att) return '';
                        if (att.dataUrl) return att.dataUrl;
                        if (
                          att.storageUrl &&
                          (att.storageUrl.startsWith('data:') || att.storageUrl.startsWith('blob:'))
                        ) {
                          return att.storageUrl;
                        }
                        const candidate =
                          att.storageUrl || att.directUrl || att.downloadUrl || '';
                        if (!candidate) return '';
                        if (candidate.startsWith('data:') || candidate.startsWith('blob:')) {
                          return candidate;
                        }
                        // Convert recipient landing page URL /#download/:token to stream API /api/download/:token?inline=true
                        if (candidate.includes('/#download/')) {
                          return candidate.replace('/#download/', '/api/download/') + '?inline=true';
                        }
                        if (candidate.includes('/api/download/') && !candidate.includes('inline=')) {
                          return candidate + (candidate.includes('?') ? '&inline=true' : '?inline=true');
                        }
                        return candidate;
                      };

                      const mediaUrl = isMedia ? getInlineMediaUrl(attachment) : '';

                      // Caption filtering: ignore default automated labels when displaying media
                      const rawText = (msg.text || msg.content || '').trim();
                      const isAutoText =
                        rawText === '📷 Sent a photo' ||
                        rawText.startsWith('📎 Sent an attachment:') ||
                        rawText === `📎 Sent an attachment: ${attachment?.fileName}`;
                      const displayCaption = isMedia && isAutoText ? '' : rawText;

                      return (
                        <div
                          style={{
                            borderRadius: isMe
                              ? isConsecutive
                                ? '16px 4px 4px 16px'
                                : '16px 16px 2px 16px'
                              : isConsecutive
                              ? '4px 16px 16px 4px'
                              : '16px 16px 16px 2px',
                            backgroundColor: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                            color: isMe ? '#ffffff' : 'var(--text-main)',
                            border: isMe ? 'none' : '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-sm)',
                            fontSize: '14px',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                            padding: isMedia ? '4px' : '9px 13px',
                            maxWidth: isMedia ? '330px' : '100%',
                          }}
                        >
                          {/* 1. MEDIA PRESENTATION (Photos / Videos directly like WhatsApp) */}
                          {isMedia && (
                            <div style={{ position: 'relative' }}>
                              {isImage && (
                                <div
                                  className="media-container"
                                  style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    backgroundColor: 'rgba(0,0,0,0.06)',
                                    position: 'relative',
                                  }}
                                  onClick={() =>
                                    setSelectedLightboxImage({
                                      url: mediaUrl,
                                      name: attachment.fileName,
                                    })
                                  }
                                  title="Click to view full photo"
                                >
                                  <img
                                    src={mediaUrl}
                                    alt={attachment.fileName || 'Photo'}
                                    style={{
                                      width: '100%',
                                      maxHeight: '350px',
                                      objectFit: 'cover',
                                      display: 'block',
                                      borderRadius: '12px',
                                    }}
                                    loading="lazy"
                                    onError={(e) => {
                                      if (attachment.downloadUrl && !e.target.dataset.retried) {
                                        e.target.dataset.retried = 'true';
                                        const fallback = attachment.downloadUrl.includes('/#download/')
                                          ? attachment.downloadUrl.replace(
                                              '/#download/',
                                              '/api/download/'
                                            ) + '?inline=true'
                                          : attachment.downloadUrl;
                                        if (fallback !== e.target.src) e.target.src = fallback;
                                      }
                                    }}
                                  />
                                  {/* WhatsApp-Style Hover Zoom Overlay */}
                                  <div
                                    className="media-overlay"
                                    style={{
                                      position: 'absolute',
                                      top: '8px',
                                      right: '8px',
                                      backgroundColor: 'rgba(0, 0, 0, 0.55)',
                                      color: '#ffffff',
                                      borderRadius: '50%',
                                      width: '28px',
                                      height: '28px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      backdropFilter: 'blur(4px)',
                                    }}
                                  >
                                    <Maximize2 size={13} />
                                  </div>
                                </div>
                              )}

                              {isVideo && (
                                <div
                                  style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    backgroundColor: '#000000',
                                  }}
                                >
                                  <video
                                    controls
                                    playsInline
                                    preload="metadata"
                                    src={mediaUrl}
                                    style={{
                                      width: '100%',
                                      maxHeight: '350px',
                                      display: 'block',
                                      borderRadius: '12px',
                                    }}
                                  />
                                </div>
                              )}

                              {/* Caption directly beneath media in WhatsApp style */}
                              {displayCaption && (
                                <div
                                  style={{
                                    padding: '6px 8px 4px 8px',
                                    fontSize: '14px',
                                    lineHeight: 1.4,
                                    color: isMe ? '#ffffff' : 'var(--text-main)',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  {displayCaption}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. NON-MEDIA MESSAGES (Regular text or non-media documents) */}
                          {!isMedia && (
                            <>
                              {displayCaption && <div>{displayCaption}</div>}

                              {/* Non-media attachment card (PDF, ZIP, DOC, etc.) */}
                              {attachment && (
                                <div style={{ marginTop: displayCaption ? '8px' : '0' }}>
                                  <div
                                    style={{
                                      padding: '10px 12px',
                                      borderRadius: '10px',
                                      backgroundColor: isMe
                                        ? 'rgba(255, 255, 255, 0.15)'
                                        : 'var(--bg-card-subtle)',
                                      border: `1px solid ${
                                        isMe ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-subtle)'
                                      }`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '12px',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        minWidth: 0,
                                      }}
                                    >
                                      <FileText size={18} />
                                      <div style={{ minWidth: 0 }}>
                                        <div
                                          style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {attachment.fileName}
                                        </div>
                                        <div style={{ fontSize: '11px', opacity: 0.85 }}>
                                          {formatBytes(attachment.fileSize)}
                                        </div>
                                      </div>
                                    </div>

                                    <a
                                      href={
                                        getInlineMediaUrl(attachment) || attachment.downloadUrl
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={attachment.fileName}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backgroundColor: isMe ? '#ffffff' : 'var(--accent-primary)',
                                        color: isMe ? 'var(--accent-primary)' : '#ffffff',
                                        padding: '6px 12px',
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
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
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
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center' }}
                        title={
                          msg.status === 'sending'
                            ? 'Sending...'
                            : isRead
                            ? 'Read'
                            : isDelivered
                            ? 'Delivered'
                            : 'Sent'
                        }
                      >
                        {msg.status === 'sending' ? (
                          <Clock size={11} style={{ opacity: 0.6 }} />
                        ) : isRead ? (
                          <CheckCheck size={13} color="#38bdf8" />
                        ) : isDelivered ? (
                          <CheckCheck size={13} style={{ opacity: 0.75 }} />
                        ) : (
                          <Check size={13} style={{ opacity: 0.75 }} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Jump-to-Latest Button */}
      {showScrollBottom && (
        <button
          onClick={() => {
            isNearBottomRef.current = true;
            scrollToBottom(true);
          }}
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
                inputRef.current?.focus();
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

      {/* Message Input Bar (WhatsApp-style layout: File, Camera, Emoji, Text Input, Send) */}
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
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAttachment}
          title="Attach files (unlimited size)"
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

        {/* WhatsApp-style Camera Button */}
        <button
          type="button"
          onClick={() => setIsCameraOpen(true)}
          title="Take Photo with Camera"
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
          <Camera size={16} />
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
          ref={inputRef}
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

      {/* WhatsApp-Style Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSendPhoto={handleCameraPhotoSent}
        roomTitle={room.displayTitle}
      />

      {/* Fullscreen Photo Lightbox (WhatsApp-style) */}
      {selectedLightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedLightboxImage(null)}
          className="lightbox-animate"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          {/* Top Control Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              zIndex: 10,
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                maxWidth: '65%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedLightboxImage.name || 'Photo'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href={selectedLightboxImage.url}
                download={selectedLightboxImage.name || 'photo.jpg'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')
                }
              >
                <Download size={15} />
                <span>Save</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedLightboxImage(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')
                }
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Centered High-Res Image */}
          <img
            src={selectedLightboxImage.url}
            alt={selectedLightboxImage.name || 'Full photo preview'}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '84vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
            }}
          />
        </div>
      )}
    </div>
  );
}
