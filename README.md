# AeroDrop — Instant Email File & Folder Sharing Platform

A minimal, professional web platform that lets users send files or folders directly to someone's email in one flow. Built as a hybrid of a modern email composer and a secure high-speed file transfer tool (in the spirit of WeTransfer, built around an email-first composer UI).

---

## 🚀 Key Features

### 1. Core User Flow & Compose Screen
- **Minimal Email Client UI**: Centered single-column compose card on a subtly textured backdrop with generous white space.
- **Multiple Recipients Input**: Real-time email validation supporting comma/Enter chip input, backspace removal, and individual chip dismiss.
- **Optional/Auto-filled Sender Email**: Remembered sender identity across sessions or customizable in Settings.
- **Subject & Rich-ish Message Area**: Supports multiline notes and instructions formatted gracefully into transactional emails.
- **File & Folder Input**:
  - Full drag-and-drop zone with animated states (idle dashed border, hover glow, bounce, and brief drop pulse).
  - Dual action buttons: **"Select Files"** and **"Select Entire Folder"** using native `<input type="file" webkitdirectory multiple>`.
  - Multi-file chips with icons, truncated names, tooltips, formatted sizes, and hover scale/fade remove buttons.
  - Client-side 2GB file size guard.

### 2. Submission & Upload Engine
- **Real-Time Progress**: Animated progress bar tracking overall transfer and per-file progress with subtle shimmer/gradient sweep.
- **State Morphing**: Submit button dynamically morphs into a loading spinner and then a checkmark pop before revealing confirmation.
- **Server-Side Zipping**: Automatically bundles folders and multi-file packages into compressed `.zip` archives via Node `archiver`, preserving folder hierarchies.
- **Secure Expiring Download Links**: Cryptographically random 128-bit hex tokens (`crypto.randomBytes`) with configurable expiry (1, 3, 7, 30 days) and optional download limits.
- **Instant Transactional Email Dispatched**: Sent instantly to all recipients with clean, branded HTML email template featuring subject, sender note, prominent "Download Files" CTA, file summary table, and expiry notice.
- **Success Screen**: Copyable expiring link with 1-click clipboard feedback ("Copied!"), confetti celebration, "Open Recipient Page", and "View Sent Email".

### 3. Recipient Download Landing Page (`/#download/:token`)
- Recipient receives email and clicks link to access the landing page.
- Displays sender email, subject, sender's personalized note, item count, total size, and live expiry countdown.
- Individual file download links and a primary **"Download All (ZIP)"** button.
- Server-side download tracking: logs download count, timestamp, IP, and user-agent.

### 4. Transfer Status / History Screen
- List of past transfers with real-time badges (`Sent`, `Downloaded (Nx)`, `Expired`).
- Interactive search filter by subject, recipient, or sender.
- Direct quick actions: Copy Link, Open Download Page, View Sent Email.
- Subtle card hover elevation (`transform: translateY(-2px)` and shadow lift).

### 5. Transactional Email Inspector / Outbox Modal
- In-app preview modal allowing instant inspection of all generated HTML emails dispatched by the platform.
- Displays responsive branded template with direct "Open in New Tab" and fallback links.

### 6. Platform Settings & Theme Preference
- **Day/Night Theme Toggle**: Animated header toggle with sun/moon icon rotation and sliding track (~300ms ease).
- Respects system preference (`prefers-color-scheme`) on first load, persisted in `localStorage`.
- Settings drawer for customizing default expiry days, download limits, sender auto-fill, and download alerts.

### 7. Security, Abuse Prevention & Rate Limiting
- Client and server side 2GB size guard.
- IP-based rate limiting (50 transfers/hour).
- File type restrictions and simulated antivirus scanning hook.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 8, Lucide React, Canvas Confetti, Vanilla CSS design system.
- **Backend**: Node.js v24, Express 5, Multer (multipart & folder support), Archiver (server-side zip streaming), Nodemailer (Ethereal test delivery + direct SMTP ready), Crypto.

---

## 💻 Running Locally

```bash
# Start both backend and frontend concurrently
npm run dev

# Or start individually:
npm run dev:server  # Runs Express backend on port 5000
npm run dev:client  # Runs Vite dev server on port 3000
```
