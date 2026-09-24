import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getUserById } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(__dirname, '../data');
const ROOMS_FILE = path.resolve(DATA_DIR, 'chatRooms.json');
const MESSAGES_FILE = path.resolve(DATA_DIR, 'messages.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOMS_FILE)) {
    const bundledSeed = path.resolve(__dirname, '../data/chatRooms.json');
    if (isVercel && fs.existsSync(bundledSeed)) {
      fs.copyFileSync(bundledSeed, ROOMS_FILE);
    } else {
      fs.writeFileSync(ROOMS_FILE, JSON.stringify({ rooms: [] }, null, 2), 'utf-8');
    }
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    const bundledSeed = path.resolve(__dirname, '../data/messages.json');
    if (isVercel && fs.existsSync(bundledSeed)) {
      fs.copyFileSync(bundledSeed, MESSAGES_FILE);
    } else {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify({ messages: [] }, null, 2), 'utf-8');
    }
  }
} catch (e) {
  console.warn('[ChatStorage] Storage init warning:', e.message);
}

function getRoomsDB() {
  try {
    const raw = fs.readFileSync(ROOMS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { rooms: [] };
  }
}

function saveRoomsDB(data) {
  try {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving rooms DB:', e);
  }
}

function getMessagesDB() {
  try {
    const raw = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { messages: [] };
  }
}

function saveMessagesDB(data) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving messages DB:', e);
  }
}

/**
 * Basic HTML sanitizer to prevent XSS
 */
export function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get or create a direct 1-on-1 chat room between two users
 */
export function getOrCreateDirectRoom(user1Id, user2Id) {
  const db = getRoomsDB();
  const existing = db.rooms.find(
    (r) =>
      r.type === 'direct' &&
      r.memberIds.length === 2 &&
      r.memberIds.includes(user1Id) &&
      r.memberIds.includes(user2Id)
  );

  if (existing) return existing;

  const user1 = getUserById(user1Id);
  const user2 = getUserById(user2Id);
  if (!user1 || !user2) {
    throw new Error('User not found');
  }

  const now = new Date().toISOString();
  const room = {
    id: 'room_' + crypto.randomUUID(),
    name: `${user1.displayName} & ${user2.displayName}`,
    type: 'direct',
    icon: null,
    memberIds: [user1Id, user2Id],
    members: [
      { userId: user1Id, role: 'member', joinedAt: now, mutedUntil: null },
      { userId: user2Id, role: 'member', joinedAt: now, mutedUntil: null },
    ],
    createdBy: user1Id,
    createdAt: now,
    lastMessageAt: now,
    lastMessageText: 'Conversation started',
  };

  db.rooms.unshift(room);
  saveRoomsDB(db);
  return room;
}

/**
 * Create a new Group Chat
 */
export function createGroupRoom({ name, memberIds, createdBy, icon = null }) {
  const db = getRoomsDB();
  const now = new Date().toISOString();

  // Ensure creator is in memberIds
  const allMemberIds = Array.from(new Set([createdBy, ...(memberIds || [])]));

  const members = allMemberIds.map((userId) => ({
    userId,
    role: userId === createdBy ? 'admin' : 'member',
    joinedAt: now,
    mutedUntil: null,
  }));

  const room = {
    id: 'room_' + crypto.randomUUID(),
    name: name.trim(),
    type: 'group',
    icon: icon || null,
    memberIds: allMemberIds,
    members,
    createdBy,
    createdAt: now,
    lastMessageAt: now,
    lastMessageText: 'Group created',
  };

  db.rooms.unshift(room);
  saveRoomsDB(db);
  return room;
}

/**
 * Get all rooms for a specific user, enriched with metadata, unread count, and other user info
 */
export function getUserRooms(userId) {
  const db = getRoomsDB();
  const msgDb = getMessagesDB();

  const userRooms = db.rooms.filter((r) => r.memberIds.includes(userId));

  return userRooms.map((room) => {
    // Determine dynamic title for direct chat (the other person's name)
    let displayTitle = room.name;
    let otherUser = null;
    let avatarInitials = '';
    let avatarColor = 'var(--accent-primary)';

    if (room.type === 'direct') {
      const otherId = room.memberIds.find((id) => id !== userId);
      otherUser = otherId ? getUserById(otherId) : null;
      if (otherUser) {
        displayTitle = otherUser.displayName;
        avatarInitials = otherUser.initials;
        avatarColor = otherUser.color;
      }
    } else {
      avatarInitials = room.name.slice(0, 2).toUpperCase();
      avatarColor = '#4f46e5';
    }

    // Calculate unread messages
    const membership = room.members.find((m) => m.userId === userId);
    const joinedAt = membership?.joinedAt ? new Date(membership.joinedAt).getTime() : 0;

    const unreadCount = msgDb.messages.filter(
      (m) =>
        m.roomId === room.id &&
        new Date(m.createdAt).getTime() >= joinedAt &&
        m.senderId !== userId &&
        !m.readBy.includes(userId)
    ).length;

    // Retrieve full member profiles
    const membersWithProfiles = room.members.map((m) => {
      const user = getUserById(m.userId);
      return {
        ...m,
        displayName: user?.displayName || 'User',
        email: user?.email || '',
        initials: user?.initials || 'U',
        color: user?.color || '#6366f1',
        onlineStatus: user?.onlineStatus || 'offline',
        lastSeenAt: user?.lastSeenAt,
      };
    });

    return {
      ...room,
      displayTitle,
      otherUser,
      avatarInitials,
      avatarColor,
      unreadCount,
      members: membersWithProfiles,
    };
  }).sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

/**
 * Get room by ID
 */
export function getRoomById(roomId) {
  const db = getRoomsDB();
  return db.rooms.find((r) => r.id === roomId) || null;
}

/**
 * Add a member to an existing group room
 */
export function addMemberToRoom(roomId, adminUserId, newUserId) {
  const db = getRoomsDB();
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Room not found');

  if (room.type !== 'group') throw new Error('Cannot add members to a direct message');

  // Verify admin permissions
  const adminMembership = room.members.find((m) => m.userId === adminUserId);
  if (!adminMembership || adminMembership.role !== 'admin') {
    throw new Error('Only group admins can add members');
  }

  if (room.memberIds.includes(newUserId)) {
    throw new Error('User is already a member of this group');
  }

  const now = new Date().toISOString();
  room.memberIds.push(newUserId);
  room.members.push({
    userId: newUserId,
    role: 'member',
    joinedAt: now, // Will only see messages from now on per spec!
    mutedUntil: null,
  });

  saveRoomsDB(db);
  return room;
}

/**
 * Remove a member from a group room
 */
export function removeMemberFromRoom(roomId, requestUserId, targetUserId) {
  const db = getRoomsDB();
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error('Room not found');

  if (room.type !== 'group') throw new Error('Cannot remove members from direct messages');

  const reqMembership = room.members.find((m) => m.userId === requestUserId);
  const isSelf = requestUserId === targetUserId;

  if (!isSelf && (!reqMembership || reqMembership.role !== 'admin')) {
    throw new Error('Only group admins can remove other members');
  }

  room.memberIds = room.memberIds.filter((id) => id !== targetUserId);
  room.members = room.members.filter((m) => m.userId !== targetUserId);

  saveRoomsDB(db);
  return room;
}

/**
 * Get messages for a room, honoring member join timestamp
 */
export function getRoomMessages(roomId, userId) {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Room not found');

  // Strict backend security check: user must be a member
  if (!room.memberIds.includes(userId)) {
    throw new Error('Forbidden: You are not a member of this chat room');
  }

  const membership = room.members.find((m) => m.userId === userId);
  const joinedAt = membership?.joinedAt ? new Date(membership.joinedAt).getTime() : 0;

  const msgDb = getMessagesDB();
  const roomMessages = msgDb.messages
    .filter((m) => m.roomId === roomId && new Date(m.createdAt).getTime() >= joinedAt)
    .map((m) => {
      const sender = getUserById(m.senderId);
      return {
        ...m,
        senderName: sender?.displayName || 'Unknown',
        senderInitials: sender?.initials || 'U',
        senderColor: sender?.color || '#6366f1',
        senderAvatar: sender?.avatarUrl || null,
      };
    });

  return roomMessages;
}

/**
 * Add a new message to a room
 */
export function createMessage({ roomId, senderId, text, attachmentRef = null }) {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Room not found');

  // Strict backend security: user must be a room member
  if (!room.memberIds.includes(senderId)) {
    throw new Error('Forbidden: You cannot send messages to a room you are not in');
  }

  const sender = getUserById(senderId);
  if (!sender) throw new Error('Sender user not found');

  const now = new Date().toISOString();
  const msgDb = getMessagesDB();

  const message = {
    id: 'm_' + crypto.randomUUID(),
    roomId,
    senderId, // Foreign key to User
    text: sanitizeText(text),
    attachmentRef, // Optional: attached AeroDrop file/folder
    createdAt: now,
    editedAt: null,
    deliveredTo: [senderId],
    readBy: [senderId], // Sender has read their own message
  };

  msgDb.messages.push(message);
  saveMessagesDB(msgDb);

  // Update room last activity
  const roomsDb = getRoomsDB();
  const targetRoom = roomsDb.rooms.find((r) => r.id === roomId);
  if (targetRoom) {
    targetRoom.lastMessageAt = now;
    targetRoom.lastMessageText = message.text || (attachmentRef ? '📎 File attached' : '');
    saveRoomsDB(roomsDb);
  }

  return {
    ...message,
    senderName: sender.displayName,
    senderInitials: sender.initials,
    senderColor: sender.color,
    senderAvatar: sender.avatarUrl,
  };
}

/**
 * Mark messages in a room as read by user
 */
export function markRoomMessagesAsRead(roomId, userId) {
  const msgDb = getMessagesDB();
  let updatedCount = 0;

  msgDb.messages.forEach((m) => {
    if (m.roomId === roomId && !m.readBy.includes(userId)) {
      m.readBy.push(userId);
      if (!m.deliveredTo.includes(userId)) {
        m.deliveredTo.push(userId);
      }
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    saveMessagesDB(msgDb);
  }

  return updatedCount;
}

/**
 * Mark message as delivered to user
 */
export function markMessageDelivered(messageId, userId) {
  const msgDb = getMessagesDB();
  const msg = msgDb.messages.find((m) => m.id === messageId);
  if (msg && !msg.deliveredTo.includes(userId)) {
    msg.deliveredTo.push(userId);
    saveMessagesDB(msgDb);
  }
}
