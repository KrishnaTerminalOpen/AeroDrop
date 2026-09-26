import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { ZipArchive } from 'archiver';
import {
  isSupabaseConfigured,
  supabaseCreateTransfer,
  supabaseGetTransferByToken,
  supabaseRecordDownload,
  supabaseGetUserTransfers,
  supabaseDownloadFileBuffer,
} from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp/data' : path.resolve(__dirname, '../data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'transfers.json');

// Ensure directories exist for local fallback
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const bundledSeed = path.resolve(__dirname, '../data/transfers.json');
    if (isVercel && fs.existsSync(bundledSeed)) {
      fs.copyFileSync(bundledSeed, DB_FILE);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify({ transfers: [] }, null, 2), 'utf-8');
    }
  }
} catch (e) {
  console.warn('[Storage] Storage init warning:', e.message);
}

/**
 * Read all transfers from disk (JSON fallback)
 */
export function getTransfersDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading transfers database:', err);
    return { transfers: [] };
  }
}

/**
 * Save transfers to disk (JSON fallback)
 */
export function saveTransfersDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving transfers database:', err);
  }
}

/**
 * Generate a cryptographically secure, non-guessable download token
 */
export function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a new transfer record
 */
export async function createTransfer({
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
  if (isSupabaseConfigured()) {
    return await supabaseCreateTransfer({
      userId,
      senderName,
      senderEmail,
      recipientEmails,
      subject,
      description,
      files,
      expiryDays,
      downloadLimit,
    });
  }

  const db = getTransfersDB();
  const transferId = 'tr_' + crypto.randomUUID();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  let totalSize = 0;
  const processedFiles = files.map((f) => {
    const size = f.size || f.sizeBytes || 0;
    totalSize += size;
    return {
      id: 'f_' + crypto.randomUUID(),
      transferId,
      originalName: f.originalname || f.originalName,
      relativePath: f.relativePath || f.originalname || f.originalName,
      sizeBytes: size,
      storageKey: f.filename || f.storageKey,
      mimeType: f.mimetype || f.mimeType || 'application/octet-stream',
    };
  });

  const transfer = {
    id: transferId,
    token,
    userId,
    senderName,
    senderEmail: senderEmail || 'anonymous@aerodrop.local',
    recipientEmails: Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails],
    subject: subject || 'Files shared with you via AeroDrop',
    description: description || '',
    files: processedFiles,
    fileKeys: processedFiles.map((f) => f.storageKey),
    totalSize,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    expiryDays,
    downloadCount: 0,
    downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
    status: 'sent',
    zipFileName:
      processedFiles.length > 1 || processedFiles.some((f) => f.relativePath.includes('/'))
        ? `${(subject || 'transfer').replace(/[^a-z0-9_-]/gi, '_')}.zip`
        : null,
    downloads: [],
  };

  db.transfers.unshift(transfer);
  saveTransfersDB(db);

  return transfer;
}

/**
 * Find transfer by secure token
 */
export async function getTransferByToken(token) {
  if (isSupabaseConfigured()) {
    return await supabaseGetTransferByToken(token);
  }

  const db = getTransfersDB();
  const transfer = db.transfers.find((t) => t.token === token);
  if (!transfer) return null;

  // Auto-check expiry
  const now = new Date();
  const expires = new Date(transfer.expiresAt);
  if (now > expires && transfer.status !== 'expired') {
    transfer.status = 'expired';
    saveTransfersDB(db);
  }

  return transfer;
}

/**
 * Record a download event and increment downloadCount
 */
export async function recordDownload(token, ip = '127.0.0.1', userAgent = '') {
  if (isSupabaseConfigured()) {
    return await supabaseRecordDownload(token, ip, userAgent);
  }

  const db = getTransfersDB();
  const index = db.transfers.findIndex((t) => t.token === token);
  if (index === -1) return null;

  const transfer = db.transfers[index];
  transfer.downloadCount += 1;
  transfer.status = 'downloaded';
  transfer.downloads.push({
    timestamp: new Date().toISOString(),
    ip,
    userAgent,
  });

  saveTransfersDB(db);
  return transfer;
}

/**
 * Get user transfers for history
 */
export async function getUserTransfers(userId, userEmail) {
  if (isSupabaseConfigured()) {
    return await supabaseGetUserTransfers(userId, userEmail);
  }

  const db = getTransfersDB();
  const now = new Date();
  const emailLower = (userEmail || '').toLowerCase();

  return db.transfers
    .filter((t) => {
      return (
        (userId && t.userId === userId) ||
        (t.senderEmail && t.senderEmail.toLowerCase() === emailLower)
      );
    })
    .map((t) => {
      const isExpired = now > new Date(t.expiresAt);
      return {
        id: t.id,
        token: t.token,
        senderEmail: t.senderEmail,
        recipientEmails: t.recipientEmails,
        subject: t.subject,
        description: t.description,
        fileCount: t.files?.length || 0,
        totalSize: t.totalSize,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        downloadCount: t.downloadCount,
        downloadLimit: t.downloadLimit,
        status: isExpired ? 'expired' : t.status,
        filesSummary: (t.files || []).slice(0, 3).map((f) => f.originalName),
      };
    });
}

/**
 * Create a ZIP stream of all files in a transfer
 */
export async function streamTransferZip(transfer, res) {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const downloadFilename = transfer.zipFileName || `aerodrop-${transfer.token.slice(0, 8)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);

  archive.pipe(res);

  for (const file of transfer.files) {
    const entryName = file.relativePath || file.originalName;

    if (isSupabaseConfigured() && !fs.existsSync(getFilePath(file.storageKey))) {
      try {
        const fileBuffer = await supabaseDownloadFileBuffer(file.storageKey);
        archive.append(fileBuffer, { name: entryName });
      } catch (err) {
        console.error(`[ZIP Stream] Error fetching file from Supabase (${file.originalName}):`, err.message);
      }
    } else {
      const filePath = path.join(UPLOADS_DIR, file.storageKey);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: entryName });
      }
    }
  }

  return archive.finalize();
}

/**
 * Get absolute path for a locally uploaded file
 */
export function getFilePath(storageKey) {
  return path.join(UPLOADS_DIR, storageKey);
}