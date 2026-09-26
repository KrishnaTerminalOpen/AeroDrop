import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be defined in your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const DATA_DIR = path.resolve(__dirname, '../data');

async function migrate() {
  console.log('🚀 Starting AeroDrop data migration to Supabase...\n');

  // 1. Migrate Users
  const usersPath = path.join(DATA_DIR, 'users.json');
  if (fs.existsSync(usersPath)) {
    try {
      const { users = [] } = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      console.log(`Found ${users.length} users to migrate...`);

      for (const u of users) {
        const row = {
          id: u.id,
          email: u.email.toLowerCase(),
          password_hash: u.passwordHash,
          display_name: u.displayName,
          avatar_url: u.avatarUrl || null,
          initials: u.initials || 'U',
          color: u.color || '#4f46e5',
          online_status: u.onlineStatus || 'offline',
          last_seen_at: u.lastSeenAt || new Date().toISOString(),
          created_at: u.createdAt || new Date().toISOString(),
        };

        const { error } = await supabase.from('users').upsert(row);
        if (error) console.error(`  ⚠️ User ${u.email}:`, error.message);
        else console.log(`  ✅ User ${u.displayName} (${u.email}) migrated.`);
      }
    } catch (e) {
      console.error('Error migrating users:', e.message);
    }
  }

  // 2. Migrate Chat Rooms & Members
  const roomsPath = path.join(DATA_DIR, 'chatRooms.json');
  if (fs.existsSync(roomsPath)) {
    try {
      const { rooms = [] } = JSON.parse(fs.readFileSync(roomsPath, 'utf-8'));
      console.log(`\nFound ${rooms.length} chat rooms to migrate...`);

      for (const r of rooms) {
        const roomRow = {
          id: r.id,
          name: r.name,
          type: r.type,
          icon: r.icon || null,
          member_ids: r.memberIds || [],
          created_by: r.createdBy || null,
          last_message_at: r.lastMessageAt || r.createdAt || new Date().toISOString(),
          last_message_text: r.lastMessageText || '',
          created_at: r.createdAt || new Date().toISOString(),
        };

        const { error: rErr } = await supabase.from('chat_rooms').upsert(roomRow);
        if (rErr) {
          console.error(`  ⚠️ Room ${r.name}:`, rErr.message);
        } else {
          console.log(`  ✅ Room "${r.name}" (${r.type}) migrated.`);

          // Migrate room members
          if (Array.isArray(r.members) && r.members.length > 0) {
            for (const m of r.members) {
              const memberRow = {
                room_id: r.id,
                user_id: m.userId,
                role: m.role || 'member',
                joined_at: m.joinedAt || new Date().toISOString(),
                muted_until: m.mutedUntil || null,
              };
              await supabase.from('room_members').upsert(memberRow);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error migrating chat rooms:', e.message);
    }
  }

  // 3. Migrate Messages
  const messagesPath = path.join(DATA_DIR, 'messages.json');
  if (fs.existsSync(messagesPath)) {
    try {
      const { messages = [] } = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
      console.log(`\nFound ${messages.length} messages to migrate...`);

      for (const m of messages) {
        const textVal = m.text || m.content || '';
        const msgRow = {
          id: m.id,
          room_id: m.roomId || m.conversationId,
          conversation_id: m.conversationId || m.roomId,
          sender_id: m.senderId || null,
          receiver_id: m.receiverId || null,
          text: textVal,
          content: textVal,
          attachment_ref: m.attachmentRef || null,
          delivered_to: m.deliveredTo || [],
          read_by: m.readBy || [],
          created_at: m.createdAt || new Date().toISOString(),
          edited_at: m.editedAt || null,
        };

        const { error: mErr } = await supabase.from('messages').upsert(msgRow);
        if (mErr) console.error(`  ⚠️ Message ${m.id}:`, mErr.message);
      }
      console.log(`  ✅ Messages migrated.`);
    } catch (e) {
      console.error('Error migrating messages:', e.message);
    }
  }

  // 4. Migrate Transfers
  const transfersPath = path.join(DATA_DIR, 'transfers.json');
  if (fs.existsSync(transfersPath)) {
    try {
      const { transfers = [] } = JSON.parse(fs.readFileSync(transfersPath, 'utf-8'));
      console.log(`\nFound ${transfers.length} transfers to migrate...`);

      for (const t of transfers) {
        const transferRow = {
          id: t.id,
          token: t.token,
          user_id: t.userId || null,
          sender_name: t.senderName || null,
          sender_email: t.senderEmail,
          recipient_emails: t.recipientEmails || [],
          subject: t.subject || '',
          description: t.description || '',
          total_size: t.totalSize || 0,
          expiry_days: t.expiryDays || 7,
          download_count: t.downloadCount || 0,
          download_limit: t.downloadLimit || null,
          status: t.status || 'sent',
          zip_file_name: t.zipFileName || null,
          downloads: t.downloads || [],
          created_at: t.createdAt || new Date().toISOString(),
          expires_at: t.expiresAt || new Date().toISOString(),
        };

        const { error: tErr } = await supabase.from('transfers').upsert(transferRow);
        if (tErr) console.error(`  ⚠️ Transfer ${t.token}:`, tErr.message);
        else console.log(`  ✅ Transfer "${t.subject || t.token}" migrated.`);

        // Migrate transfer files
        if (Array.isArray(t.files) && t.files.length > 0) {
          for (const f of t.files) {
            const fileRow = {
              id: f.id,
              transfer_id: t.id,
              original_name: f.originalName,
              relative_path: f.relativePath || f.originalName,
              size_bytes: f.sizeBytes || 0,
              storage_key: f.storageKey,
              storage_url: f.storageUrl || null,
              mime_type: f.mimeType || 'application/octet-stream',
              created_at: f.uploadedAt || t.createdAt || new Date().toISOString(),
            };
            await supabase.from('transfer_files').upsert(fileRow);
          }
        }
      }
    } catch (e) {
      console.error('Error migrating transfers:', e.message);
    }
  }

  console.log('\n🎉 Supabase Migration Completed Successfully!');
}

migrate().catch(console.error);
