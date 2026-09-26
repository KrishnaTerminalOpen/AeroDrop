# 🚀 AeroDrop Supabase Integration Guide

## Why this solves the domain / deployment issues
When running AeroDrop on a custom domain (e.g. Vercel, Netlify, or serverless hosts):
1. **Serverless Filesystem is Read-Only & Ephemeral**: Local files (`data/*.json` and `data/uploads/`) reset or vanish between requests and cannot persist user uploads or messages.
2. **WebSockets Fail on Serverless**: Long-running Socket.IO servers cannot maintain stateful connections on serverless functions.

### How Supabase Fixes Everything:
- **PostgreSQL Database**: Persistently stores all users, chat rooms, room memberships, messages, and transfer metadata.
- **Supabase Storage**: Stores file uploads in the `aerodrop-uploads` bucket (supports up to 2GB per file) with instant CDN download links.
- **Supabase Realtime**: Connects directly from the browser client via Supabase Realtime channels (`messages`, `chat_rooms`, and `presence`) for instant live chat and presence across the globe without needing stateful servers!

---

## 3-Step Setup Instructions

### Step 1: Create Supabase Tables & Storage Bucket
1. Log in to [Supabase](https://supabase.com) and open or create a project.
2. Go to the **SQL Editor** tab on the left sidebar.
3. Click **New Query**, open the file [`supabase/schema.sql`](file:///c:/Users/Admin/Desktop/new%20project/supabase/schema.sql) from this project, copy its contents, paste it into the SQL editor, and click **Run**.
4. This will automatically create:
   - `users`, `chat_rooms`, `room_members`, `messages`, `transfers`, and `transfer_files` tables
   - Indexes and Row Level Security policies
   - The `aerodrop-uploads` storage bucket with public access policies
   - Supabase Realtime replication on `messages`, `chat_rooms`, and `users`

---

### Step 2: Configure Environment Variables
In your Supabase project dashboard:
1. Go to **Project Settings** -> **API**.
2. Copy your **Project URL**, **anon public key**, and **service_role key**.
3. Open [`.env`](file:///c:/Users/Admin/Desktop/new%20project/.env) and fill in the values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Frontend variables (Vite)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> **Note for Vercel / Domain Deployment:**
> Add these same environment variables in your **Vercel Project Settings -> Environment Variables** so they take effect on your domain!

---

### Step 3 (Optional): Migrate Existing Local Data
To transfer all your existing users, chat conversations, and transfer history from your local files to Supabase:
```bash
npm run db:migrate
```

---

## Graceful Fallback
If `SUPABASE_URL` is ever omitted or during offline local work, AeroDrop automatically and smoothly falls back to the local JSON database and Socket.IO so your app never breaks.
