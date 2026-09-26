-- ==============================================================================
-- AeroDrop Supabase Database Schema
-- Run this script in your Supabase Project: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  initials TEXT NOT NULL DEFAULT 'U',
  color TEXT NOT NULL DEFAULT '#4f46e5',
  online_status TEXT NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on user email for fast authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));

-- 2. CHAT ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  icon TEXT,
  member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at ON public.chat_rooms (last_message_at DESC);

-- 3. ROOM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.room_members (
  room_id TEXT NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  muted_until TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);

-- 4. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  conversation_id TEXT,
  sender_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  receiver_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  attachment_ref JSONB,
  delivered_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_room_created ON public.messages (room_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);

-- 5. TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.transfers (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_email TEXT NOT NULL,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT DEFAULT '',
  description TEXT DEFAULT '',
  total_size BIGINT NOT NULL DEFAULT 0,
  expiry_days INT NOT NULL DEFAULT 7,
  download_count INT NOT NULL DEFAULT 0,
  download_limit INT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('uploading', 'sent', 'downloaded', 'expired')),
  zip_file_name TEXT,
  downloads JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfers_token ON public.transfers (token);
CREATE INDEX IF NOT EXISTS idx_transfers_user ON public.transfers (user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_sender_email ON public.transfers (LOWER(sender_email));

-- 6. TRANSFER FILES TABLE
CREATE TABLE IF NOT EXISTS public.transfer_files (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  storage_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_files_transfer ON public.transfer_files (transfer_id);

-- 7. SUPABASE STORAGE BUCKET FOR FILE UPLOADS
-- Creates the 'aerodrop-uploads' storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aerodrop-uploads',
  'aerodrop-uploads',
  true,
  2147483648, -- 2 GB limit per file
  NULL        -- Allow any file type
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public Storage Access Policies for downloading & uploading files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for AeroDrop Uploads' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public Access for AeroDrop Uploads"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'aerodrop-uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow Uploads to AeroDrop Bucket' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow Uploads to AeroDrop Bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'aerodrop-uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow Deletes from AeroDrop Bucket' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow Deletes from AeroDrop Bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'aerodrop-uploads');
  END IF;
END $$;

-- 8. REALTIME REPLICATION CONFIGURATION
-- Enable Supabase Realtime for instant messaging and presence across clients
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Ensure RLS is disabled or open for service role / API
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_files ENABLE ROW LEVEL SECURITY;

-- Permissive service/anon policies so backend and frontend client can query with their keys
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on chat_rooms" ON public.chat_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on room_members" ON public.room_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transfers" ON public.transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transfer_files" ON public.transfer_files FOR ALL USING (true) WITH CHECK (true);
