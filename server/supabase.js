import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const DEFAULT_SUPABASE_URL = 'https://vajubgvrkeqxqfcibxzo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Hh7uigoNI1U5eZTP_WliHg_3rFdIZ1h';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const JWT_SECRET = process.env.JWT_SECRET || 'aerodrop_super_secret_jwt_key_2026_xyz';
const BUCKET_NAME = 'aerodrop-uploads';

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    console.log('✅ Supabase client initialized successfully with URL:', SUPABASE_URL);
  } catch (err) {
    console.error('❌ Failed to initialize Supabase client:', err.message);
  }
}

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

export function getSupabaseClient() {
  return supabase;
}

// User color palette for deterministic or random distinct avatar themes
const USER_COLORS = [
  '#4f46e5', '#0284c7', '#059669', '#d97706', '#db2777',
  '#7c3aed', '#0d9488', '#ea580c', '#2563eb', '#16a34a',
];

function generateInitials(displayName = '') {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, passwordHash, ...safe } = u;
  return {
    id: safe.id,
    email: safe.email,
    displayName: safe.display_name || safe.displayName,
    avatarUrl: safe.avatar_url || safe.avatarUrl || null,
    initials: safe.initials || 'U',
    color: safe.color || '#4f46e5',
    onlineStatus: safe.online_status || safe.onlineStatus || 'offline',
    lastSeenAt: safe.last_seen_at || safe.lastSeenAt,
    createdAt: safe.created_at || safe.createdAt,
  };
}

/* ==============================================================================
   USER AUTHENTICATION & MANAGEMENT
   ============================================================================== */

export async function supabaseRegisterUser({ email, password, displayName, avatarUrl = null }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    const err = new Error('An account with this email already exists.');
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const color = USER_COLORS[(count || 0) % USER_COLORS.length];
  const initials = generateInitials(displayName || email.split('@')[0]);
  const userId = 'u_' + crypto.randomUUID();
  const now = new Date().toISOString();

  const newUserRow = {
    id: userId,
    email: normalizedEmail,
    password_hash: passwordHash,
    display_name: displayName.trim() || email.split('@')[0],
    avatar_url: avatarUrl,
    initials,
    color,
    online_status: 'online',
    last_seen_at: now,
    created_at: now,
  };

  const { data, error } = await supabase.from('users').insert([newUserRow]).select().single();
  if (error) {
    console.error('[Supabase Register Error]:', error);
    throw new Error(error.message);
  }

  const user = sanitizeUser(data);
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      color: user.color,
      initials: user.initials,
      avatarUrl: user.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user, token };
}

export async function supabaseLoginUser({ email, password }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const normalizedEmail = email.trim().toLowerCase();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error || !user) {
    const err = new Error('No account found with this email. Please check your email or create a new account.');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Incorrect password. Please verify your password and try again.');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const now = new Date().toISOString();
  await supabase
    .from('users')
    .update({ online_status: 'online', last_seen_at: now })
    .eq('id', user.id);

  const safeUser = sanitizeUser({ ...user, online_status: 'online', last_seen_at: now });
  const token = jwt.sign(
    {
      id: safeUser.id,
      email: safeUser.email,
      displayName: safeUser.displayName,
      color: safeUser.color,
      initials: safeUser.initials,
      avatarUrl: safeUser.avatarUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { user: safeUser, token };
}

export async function supabaseGetUserById(userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  return sanitizeUser(data);
}

export async function supabaseGetAllUsers(excludeUserId = null) {
  if (!supabase) return [];
  let query = supabase.from('users').select('*').order('created_at', { ascending: false });
  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[Supabase GetAllUsers Error]:', error);
    return [];
  }
  return (data || []).map(sanitizeUser);
}

export async function supabaseUpdateUserOnlineStatus(userId, status) {
  if (!supabase || !userId) return;
  await supabase
    .from('users')
    .update({
      online_status: status,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

/* ==============================================================================
   CHAT ROOMS & MEMBERS
   ============================================================================== */

export async function supabaseGetOrCreateDirectRoom(user1Id, user2Id) {
  if (!supabase) throw new Error('Supabase is not configured');

  // Check if a direct room with these two users exists
  const { data: existingRooms, error } = await supabase
    .from('chat_rooms')
    .select('*, room_members(*)')
    .eq('type', 'direct');

  if (!error && existingRooms) {
    const match = existingRooms.find((r) => {
      const ids = Array.isArray(r.member_ids) ? r.member_ids : [];
      return ids.length === 2 && ids.includes(user1Id) && ids.includes(user2Id);
    });
    if (match) {
      return formatRoomRecord(match);
    }
  }

  const user1 = await supabaseGetUserById(user1Id);
  const user2 = await supabaseGetUserById(user2Id);
  if (!user1 || !user2) throw new Error('One or both users not found');

  const roomId = 'room_' + crypto.randomUUID();
  const now = new Date().toISOString();

  const newRoom = {
    id: roomId,
    name: `${user1.displayName} & ${user2.displayName}`,
    type: 'direct',
    icon: null,
    member_ids: [user1Id, user2Id],
    created_by: user1Id,
    last_message_at: now,
    last_message_text: 'Conversation started',
    created_at: now,
  };

  const { data: createdRoom, error: roomErr } = await supabase
    .from('chat_rooms')
    .insert([newRoom])
    .select()
    .single();

  if (roomErr) throw new Error(roomErr.message);

  // Insert membership records
  await supabase.from('room_members').insert([
    { room_id: roomId, user_id: user1Id, role: 'member', joined_at: now },
    { room_id: roomId, user_id: user2Id, role: 'member', joined_at: now },
  ]);

  return formatRoomRecord({
    ...createdRoom,
    room_members: [
      { room_id: roomId, user_id: user1Id, role: 'member', joined_at: now },
      { room_id: roomId, user_id: user2Id, role: 'member', joined_at: now },
    ],
  });
}

export async function supabaseCreateGroupRoom({ name, memberIds = [], createdBy, icon = null }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const roomId = 'room_' + crypto.randomUUID();
  const now = new Date().toISOString();
  const allMemberIds = Array.from(new Set([createdBy, ...memberIds]));

  const newRoom = {
    id: roomId,
    name: name.trim(),
    type: 'group',
    icon: icon || null,
    member_ids: allMemberIds,
    created_by: createdBy,
    last_message_at: now,
    last_message_text: 'Group created',
    created_at: now,
  };

  const { data: createdRoom, error: roomErr } = await supabase
    .from('chat_rooms')
    .insert([newRoom])
    .select()
    .single();

  if (roomErr) throw new Error(roomErr.message);

  const memberRows = allMemberIds.map((uId) => ({
    room_id: roomId,
    user_id: uId,
    role: uId === createdBy ? 'admin' : 'member',
    joined_at: now,
  }));

  await supabase.from('room_members').insert(memberRows);

  return formatRoomRecord({
    ...createdRoom,
    room_members: memberRows,
  });
}

export async function supabaseGetUserRooms(userId) {
  if (!supabase || !userId) return [];

  // Query rooms where user is a member
  const { data: memberRecords, error: mErr } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);

  if (mErr || !memberRecords || memberRecords.length === 0) return [];

  const roomIds = memberRecords.map((m) => m.room_id);

  const { data: rooms, error: rErr } = await supabase
    .from('chat_rooms')
    .select('*, room_members(*)')
    .in('id', roomIds)
    .order('last_message_at', { ascending: false });

  if (rErr || !rooms) return [];

  const enrichedRooms = await Promise.all(
    rooms.map((r) => supabaseEnrichRoom(formatRoomRecord(r), userId))
  );

  return enrichedRooms;
}

export async function supabaseGetRoomById(roomId, userId = null) {
  if (!supabase || !roomId) return null;

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('*, room_members(*)')
    .eq('id', roomId)
    .maybeSingle();

  if (error || !room) return null;

  const formatted = formatRoomRecord(room);
  if (userId) {
    return await supabaseEnrichRoom(formatted, userId);
  }
  return formatted;
}

export async function supabaseEnrichRoom(room, userId) {
  if (!room) return null;

  let displayTitle = room.name || 'Chat';
  let otherUser = null;
  let avatarInitials = '';
  let avatarColor = 'var(--accent-primary)';

  if (room.type === 'direct') {
    const otherId = (room.memberIds || []).find((id) => id !== userId);
    otherUser = otherId ? await supabaseGetUserById(otherId) : null;
    if (otherUser) {
      displayTitle = otherUser.displayName;
      avatarInitials = otherUser.initials;
      avatarColor = otherUser.color;
    }
  } else {
    avatarInitials = (room.name || 'Group').slice(0, 2).toUpperCase();
    avatarColor = '#4f46e5';
  }

  // Count unread messages
  const { data: unreadRows } = await supabase
    .from('messages')
    .select('id, read_by')
    .eq('room_id', room.id)
    .neq('sender_id', userId);

  const unreadCount = (unreadRows || []).filter(
    (m) => !Array.isArray(m.read_by) || !m.read_by.includes(userId)
  ).length;

  // Retrieve full member profiles
  const memberProfiles = await Promise.all(
    (room.members || []).map(async (m) => {
      const u = await supabaseGetUserById(m.userId);
      return {
        ...m,
        displayName: u?.displayName || 'User',
        email: u?.email || '',
        initials: u?.initials || 'U',
        color: u?.color || '#6366f1',
        onlineStatus: u?.onlineStatus || 'offline',
        lastSeenAt: u?.lastSeenAt,
      };
    })
  );

  return {
    ...room,
    displayTitle,
    otherUser,
    avatarInitials,
    avatarColor,
    unreadCount,
    members: memberProfiles,
  };
}

export async function supabaseAddMemberToRoom(roomId, adminUserId, newUserId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const room = await supabaseGetRoomById(roomId);
  if (!room) throw new Error('Room not found');
  if (room.type !== 'group') throw new Error('Cannot add members to a direct message');

  const adminMember = (room.members || []).find((m) => m.userId === adminUserId);
  if (!adminMember || adminMember.role !== 'admin') {
    throw new Error('Only group admins can add members');
  }

  if ((room.memberIds || []).includes(newUserId)) {
    throw new Error('User is already a member of this group');
  }

  const now = new Date().toISOString();
  const updatedIds = [...(room.memberIds || []), newUserId];

  await supabase
    .from('chat_rooms')
    .update({ member_ids: updatedIds })
    .eq('id', roomId);

  await supabase.from('room_members').insert([
    {
      room_id: roomId,
      user_id: newUserId,
      role: 'member',
      joined_at: now,
    },
  ]);

  return await supabaseGetRoomById(roomId);
}

export async function supabaseRemoveMemberFromRoom(roomId, requestUserId, targetUserId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const room = await supabaseGetRoomById(roomId);
  if (!room) throw new Error('Room not found');
  if (room.type !== 'group') throw new Error('Cannot remove members from direct messages');

  const reqMember = (room.members || []).find((m) => m.userId === requestUserId);
  const isSelf = requestUserId === targetUserId;

  if (!isSelf && (!reqMember || reqMember.role !== 'admin')) {
    throw new Error('Only group admins can remove other members');
  }

  const updatedIds = (room.memberIds || []).filter((id) => id !== targetUserId);

  await supabase
    .from('chat_rooms')
    .update({ member_ids: updatedIds })
    .eq('id', roomId);

  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', targetUserId);

  return await supabaseGetRoomById(roomId);
}

/* ==============================================================================
   MESSAGES
   ============================================================================== */

export async function supabaseGetRoomMessages(roomId, userId) {
  if (!supabase) throw new Error('Supabase is not configured');

  const room = await supabaseGetRoomById(roomId);
  if (!room) throw new Error('Room not found');

  if (!(room.memberIds || []).includes(userId)) {
    throw new Error('Forbidden: You are not a member of this chat room');
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  const formattedMessages = await Promise.all(
    (messages || []).map(async (m) => {
      const sender = await supabaseGetUserById(m.sender_id);
      const receiverId =
        room.type === 'direct'
          ? (room.memberIds || []).find((id) => id !== m.sender_id) || null
          : null;

      const textVal = m.text || m.content || '';
      return {
        id: m.id,
        roomId: m.room_id,
        conversationId: m.conversation_id || m.room_id,
        senderId: m.sender_id,
        receiverId: m.receiver_id || receiverId,
        text: textVal,
        content: textVal,
        attachmentRef: m.attachment_ref,
        createdAt: m.created_at,
        editedAt: m.edited_at,
        deliveredTo: m.delivered_to || [],
        readBy: m.read_by || [],
        senderName: sender?.displayName || 'Unknown',
        senderInitials: sender?.initials || 'U',
        senderColor: sender?.color || '#6366f1',
        senderAvatar: sender?.avatarUrl || null,
      };
    })
  );

  return formattedMessages;
}

export async function supabaseCreateMessage({ roomId, conversationId, senderId, text, content, attachmentRef = null }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const targetRoomId = roomId || conversationId;
  const room = await supabaseGetRoomById(targetRoomId);
  if (!room) throw new Error('Room not found');

  if (!(room.memberIds || []).includes(senderId)) {
    throw new Error('Forbidden: You cannot send messages to a room you are not in');
  }

  const sender = await supabaseGetUserById(senderId);
  if (!sender) throw new Error('Sender user not found');

  const receiverId =
    room.type === 'direct'
      ? (room.memberIds || []).find((id) => id !== senderId) || null
      : null;

  const rawText = text !== undefined && text !== null ? text : content || '';
  const now = new Date().toISOString();
  const messageId = 'm_' + crypto.randomUUID();

  const newMsgRow = {
    id: messageId,
    room_id: targetRoomId,
    conversation_id: targetRoomId,
    sender_id: senderId,
    receiver_id: receiverId,
    text: rawText,
    content: rawText,
    attachment_ref: attachmentRef,
    created_at: now,
    delivered_to: [senderId],
    read_by: [senderId],
  };

  const { data: createdMsg, error } = await supabase
    .from('messages')
    .insert([newMsgRow])
    .select()
    .single();

  if (error) {
    console.error('[Supabase Create Message Error]:', error);
    throw new Error(error.message);
  }

  // Update chat room last activity
  await supabase
    .from('chat_rooms')
    .update({
      last_message_at: now,
      last_message_text: rawText || (attachmentRef ? '📎 File attached' : ''),
    })
    .eq('id', targetRoomId);

  return {
    id: createdMsg.id,
    roomId: createdMsg.room_id,
    conversationId: createdMsg.conversation_id,
    senderId: createdMsg.sender_id,
    receiverId: createdMsg.receiver_id,
    text: createdMsg.text,
    content: createdMsg.content,
    attachmentRef: createdMsg.attachment_ref,
    createdAt: createdMsg.created_at,
    editedAt: createdMsg.edited_at,
    deliveredTo: createdMsg.delivered_to,
    readBy: createdMsg.read_by,
    senderName: sender.displayName,
    senderInitials: sender.initials,
    senderColor: sender.color,
    senderAvatar: sender.avatarUrl,
  };
}

export async function supabaseMarkRoomMessagesAsRead(roomId, userId) {
  if (!supabase || !roomId || !userId) return 0;

  const { data: unreadMessages } = await supabase
    .from('messages')
    .select('id, read_by, delivered_to')
    .eq('room_id', roomId);

  if (!unreadMessages) return 0;

  let updateCount = 0;
  for (const m of unreadMessages) {
    const readBy = Array.isArray(m.read_by) ? m.read_by : [];
    const deliveredTo = Array.isArray(m.delivered_to) ? m.delivered_to : [];

    if (!readBy.includes(userId)) {
      const nextRead = [...readBy, userId];
      const nextDelivered = deliveredTo.includes(userId) ? deliveredTo : [...deliveredTo, userId];

      await supabase
        .from('messages')
        .update({ read_by: nextRead, delivered_to: nextDelivered })
        .eq('id', m.id);

      updateCount++;
    }
  }

  return updateCount;
}

/* ==============================================================================
   SUPABASE STORAGE & TRANSFERS
   ============================================================================== */

/**
 * Upload a file buffer directly to the Supabase Storage bucket 'aerodrop-uploads'
 */
export async function supabaseUploadFile({ buffer, originalName, mimeType = 'application/octet-stream' }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
  const storageKey = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storageKey, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('[Supabase Storage Upload Error]:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storageKey);

  return {
    storageKey,
    storageUrl: publicUrlData?.publicUrl || null,
  };
}

/**
 * Download a file buffer directly from Supabase Storage
 */
export async function supabaseDownloadFileBuffer(storageKey) {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storageKey);
  if (error) {
    console.error('[Supabase Storage Download Error]:', error);
    throw new Error(`Failed to download file from Supabase: ${error.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a new transfer record in Supabase
 */
export async function supabaseCreateTransfer({
  userId = null,
  senderName = null,
  senderEmail,
  recipientEmails,
  subject,
  description,
  files,
  expiryDays = 7,
  downloadLimit = null,
}) {
  if (!supabase) throw new Error('Supabase is not configured');

  const transferId = 'tr_' + crypto.randomUUID();
  const token = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  let totalSize = 0;
  const processedFiles = files.map((f) => {
    const size = f.size || f.sizeBytes || 0;
    totalSize += size;
    return {
      id: 'f_' + crypto.randomUUID(),
      transfer_id: transferId,
      original_name: f.originalname || f.originalName,
      relative_path: f.relativePath || f.originalname || f.originalName,
      size_bytes: size,
      storage_key: f.storageKey || f.filename,
      storage_url: f.storageUrl || null,
      mime_type: f.mimetype || f.mimeType || 'application/octet-stream',
      created_at: now.toISOString(),
    };
  });

  const zipFileName =
    processedFiles.length > 1 || processedFiles.some((f) => f.relative_path.includes('/'))
      ? `${(subject || 'transfer').replace(/[^a-z0-9_-]/gi, '_')}.zip`
      : null;

  const recipients = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];

  let validUserId = null;
  if (userId) {
    try {
      const { data: u } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
      if (u) {
        validUserId = u.id;
      }
    } catch (e) {
      validUserId = null;
    }
  }

  const transferRow = {
    id: transferId,
    token,
    user_id: validUserId,
    sender_name: senderName,
    sender_email: senderEmail || 'anonymous@aerodrop.local',
    recipient_emails: recipients,
    subject: subject || 'Files shared with you via AeroDrop',
    description: description || '',
    total_size: totalSize,
    expiry_days: expiryDays,
    download_count: 0,
    download_limit: downloadLimit ? parseInt(downloadLimit, 10) : null,
    status: 'sent',
    zip_file_name: zipFileName,
    downloads: [],
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const { data: createdTransfer, error: tErr } = await supabase
    .from('transfers')
    .insert([transferRow])
    .select()
    .single();

  if (tErr) throw new Error(tErr.message);

  if (processedFiles.length > 0) {
    const { error: fErr } = await supabase.from('transfer_files').insert(processedFiles);
    if (fErr) console.error('[Supabase Transfer Files Insert Error]:', fErr);
  }

  return formatTransferRecord({
    ...createdTransfer,
    transfer_files: processedFiles,
  });
}

/**
 * Retrieve transfer by secure token
 */
export async function supabaseGetTransferByToken(token) {
  if (!supabase || !token) return null;

  const { data: transfer, error } = await supabase
    .from('transfers')
    .select('*, transfer_files(*)')
    .eq('token', token)
    .maybeSingle();

  if (error || !transfer) return null;

  // Auto-check expiry
  const now = new Date();
  const expires = new Date(transfer.expires_at);
  if (now > expires && transfer.status !== 'expired') {
    await supabase.from('transfers').update({ status: 'expired' }).eq('token', token);
    transfer.status = 'expired';
  }

  return formatTransferRecord(transfer);
}

/**
 * Record a download event in Supabase
 */
export async function supabaseRecordDownload(token, ip = '127.0.0.1', userAgent = '') {
  if (!supabase || !token) return null;

  const transfer = await supabaseGetTransferByToken(token);
  if (!transfer) return null;

  const nextCount = (transfer.downloadCount || 0) + 1;
  const newDownloads = [
    ...(transfer.downloads || []),
    { timestamp: new Date().toISOString(), ip, userAgent },
  ];

  await supabase
    .from('transfers')
    .update({
      download_count: nextCount,
      status: 'downloaded',
      downloads: newDownloads,
    })
    .eq('token', token);

  return {
    ...transfer,
    downloadCount: nextCount,
    status: 'downloaded',
    downloads: newDownloads,
  };
}

/**
 * Retrieve user transfers for history
 */
export async function supabaseGetUserTransfers(userId, userEmail) {
  if (!supabase) return [];

  let query = supabase
    .from('transfers')
    .select('*, transfer_files(*)')
    .order('created_at', { ascending: false });

  if (userId && userEmail) {
    query = query.or(`user_id.eq.${userId},sender_email.ilike.${userEmail}`);
  } else if (userId) {
    query = query.eq('user_id', userId);
  } else if (userEmail) {
    query = query.ilike('sender_email', userEmail);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map(formatTransferRecord);
}

/* ==============================================================================
   HELPERS & FORMATTERS
   ============================================================================== */

function formatRoomRecord(r) {
  if (!r) return null;
  const memberList = (r.room_members || []).map((m) => ({
    userId: m.user_id,
    role: m.role || 'member',
    joinedAt: m.joined_at,
    mutedUntil: m.muted_until,
  }));

  const memberIds = Array.isArray(r.member_ids)
    ? r.member_ids
    : memberList.map((m) => m.userId);

  return {
    id: r.id,
    name: r.name,
    type: r.type,
    icon: r.icon,
    memberIds,
    members: memberList,
    createdBy: r.created_by,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
    lastMessageText: r.last_message_text,
  };
}

function formatTransferRecord(t) {
  if (!t) return null;
  const files = (t.transfer_files || []).map((f) => ({
    id: f.id,
    originalName: f.original_name,
    relativePath: f.relative_path,
    sizeBytes: f.size_bytes,
    storageKey: f.storage_key,
    storageUrl: f.storage_url,
    mimeType: f.mime_type,
  }));

  return {
    id: t.id,
    token: t.token,
    userId: t.user_id,
    senderName: t.sender_name,
    senderEmail: t.sender_email,
    recipientEmails: Array.isArray(t.recipient_emails) ? t.recipient_emails : [t.recipient_emails],
    subject: t.subject,
    description: t.description,
    totalSize: t.total_size,
    expiryDays: t.expiry_days,
    downloadCount: t.download_count,
    downloadLimit: t.download_limit,
    status: t.status,
    zipFileName: t.zip_file_name,
    downloads: t.downloads || [],
    createdAt: t.created_at,
    expiresAt: t.expires_at,
    files,
    fileKeys: files.map((f) => f.storageKey),
  };
}
