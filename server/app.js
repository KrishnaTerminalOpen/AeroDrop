import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

import {
  createTransfer,
  getTransferByToken,
  recordDownload,
  streamTransferZip,
  getFilePath,
  getUserTransfers,
} from './storage.js';
import { isSupabaseConfigured, supabaseUploadFile, supabaseDownloadFileBuffer } from './supabase.js';
import { sendTransferEmail, getEmailOutbox, getEmailById } from './emailService.js';
import { rateLimiterMiddleware, scanFileForThreats } from './rateLimiter.js';
import { authMiddleware } from './auth.js';
import chatRoutes from './chatRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const UPLOADS_DIR = isVercel ? '/tmp/data/uploads' : path.resolve(__dirname, '../data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel path normalization: if rewrite passed /api/index.js, restore from x-matched-path or x-invoke-path
app.use((req, res, next) => {
  if (req.url === '/api/index.js' || req.url === '/api' || req.url.startsWith('/api/index.js')) {
    const matched = req.headers['x-matched-path'] || req.headers['x-invoke-path'];
    if (matched && matched !== '/api/index.js') {
      req.url = matched;
    }
  }
  next();
});

// Mount chat & auth routes
app.use('/api', chatRoutes);

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

// 2GB client and server side upload limit
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
  },
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
  });
});

/**
 * Provider status check
 */
app.get('/api/provider-status', (req, res) => {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
  const hasSupabase = isSupabaseConfigured();

  let activeProvider = 'none';
  if (hasResend) activeProvider = 'resend';
  else if (hasSmtp) activeProvider = 'smtp';
  else if (hasSendGrid) activeProvider = 'sendgrid';

  res.json({
    activeProvider,
    hasResend,
    hasSmtp,
    hasSendGrid,
    hasSupabase,
    fromEmail: process.env.EMAIL_FROM || (hasResend ? 'onboarding@resend.dev' : process.env.SMTP_USER || 'none'),
  });
});

/**
 * Upload Endpoint: handles multi-file and folder upload
 */
app.post(
  '/api/upload',
  authMiddleware,
  rateLimiterMiddleware,
  upload.array('files'),
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
      }

      // Enforce authenticated sender identity
      const userId = req.user?.id || null;
      const senderEmail = req.user?.email || req.body.senderEmail;
      const senderName = req.user?.displayName || null;

      const {
        recipientEmails,
        subject,
        description,
        expiryDays,
        downloadLimit,
        relativePaths,
      } = req.body;

      let recipients = [];
      try {
        recipients = typeof recipientEmails === 'string'
          ? JSON.parse(recipientEmails)
          : recipientEmails;
      } catch (e) {
        recipients = [recipientEmails];
      }

      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ error: 'At least one recipient email is required.' });
      }

      let parsedPaths = [];
      if (relativePaths) {
        try {
          parsedPaths = typeof relativePaths === 'string' ? JSON.parse(relativePaths) : relativePaths;
        } catch (e) {
          parsedPaths = [];
        }
      }

      files.forEach((file, index) => {
        if (parsedPaths[index]) {
          file.relativePath = parsedPaths[index];
        } else {
          file.relativePath = file.originalname;
        }
      });

      // Security scan
      for (const file of files) {
        const scan = await scanFileForThreats(file);
        if (!scan.safe) {
          files.forEach((f) => {
            try {
              if (f.path) fs.unlinkSync(f.path);
            } catch (err) {}
          });
          return res.status(400).json({
            error: 'Security scan rejected file',
            reason: scan.reason,
            fileName: file.originalname,
          });
        }
      }

      // If Supabase Storage is configured, upload files directly to the bucket
      if (isSupabaseConfigured()) {
        for (const file of files) {
          let buffer = file.buffer;
          if (!buffer && file.path && fs.existsSync(file.path)) {
            buffer = fs.readFileSync(file.path);
          }
          if (buffer) {
            const uploaded = await supabaseUploadFile({
              buffer,
              originalName: file.originalname,
              mimeType: file.mimetype,
            });
            file.storageKey = uploaded.storageKey;
            file.storageUrl = uploaded.storageUrl;
          }
          // Remove local temp file
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {}
          }
        }
      }

      const transfer = await createTransfer({
        userId,
        senderName,
        senderEmail,
        recipientEmails: recipients,
        subject: subject || 'Files shared via AeroDrop',
        description: description || '',
        files,
        expiryDays: expiryDays ? parseInt(expiryDays, 10) : 7,
        downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
      });

      const host = req.get('host');
      const protocol = req.protocol;
      const origin = req.get('origin') || `${protocol}://${host}`;
      const downloadUrl = `${origin}/#download/${transfer.token}`;

      let emailResults = [];
      let emailWarning = null;
      try {
        emailResults = await sendTransferEmail({
          transfer,
          downloadUrl,
        });
        const failedEmails = emailResults.filter((e) => e.status === 'failed');
        if (failedEmails.length > 0) {
          emailWarning = failedEmails[0].error || 'One or more emails failed to deliver.';
        }
      } catch (mailErr) {
        console.error('[Upload Handler] Email delivery error:', mailErr);
        emailWarning = mailErr.message || 'The email provider failed to deliver the transfer email.';
      }

      res.status(201).json({
        success: true,
        message: 'Transfer created and emails dispatched successfully',
        transfer: {
          id: transfer.id,
          token: transfer.token,
          downloadUrl,
          recipientEmails: transfer.recipientEmails,
          senderEmail: transfer.senderEmail,
          subject: transfer.subject,
          description: transfer.description,
          totalSize: transfer.totalSize,
          fileCount: transfer.files.length,
          expiresAt: transfer.expiresAt,
          expiryDays: transfer.expiryDays,
          status: transfer.status,
          files: transfer.files.map((f) => ({
            id: f.id,
            originalName: f.originalName,
            relativePath: f.relativePath,
            sizeBytes: f.sizeBytes,
            mimeType: f.mimeType,
          })),
          emailWarning,
        },
        emailWarning,
        emailsDispatched: emailResults.filter((e) => e.status === 'delivered').length,
        latestEmailId: emailResults[0]?.id || null,
        provider: emailResults[0]?.provider || 'Resend',
      });
    } catch (err) {
      console.error('Upload processing error:', err);
      res.status(500).json({ error: 'Server error during transfer creation: ' + err.message });
    }
  }
);

/**
 * Get Transfer details by token for recipient landing page
 */
app.get('/api/transfers/:token', async (req, res) => {
  const { token } = req.params;
  const transfer = await getTransferByToken(token);

  if (!transfer) {
    return res.status(404).json({
      error: 'Transfer not found',
      message: 'This link may have been deleted, never existed, or is incorrect.',
      code: 'NOT_FOUND',
    });
  }

  const now = new Date();
  const expiresAt = new Date(transfer.expiresAt);
  if (now > expiresAt || transfer.status === 'expired') {
    return res.status(410).json({
      error: 'Link Expired',
      message: `This download link expired on ${expiresAt.toLocaleDateString()}. Please request the sender to share the files again.`,
      code: 'EXPIRED',
      transfer: {
        subject: transfer.subject,
        senderEmail: transfer.senderEmail,
        expiredAt: transfer.expiresAt,
      },
    });
  }

  if (transfer.downloadLimit && transfer.downloadCount >= transfer.downloadLimit) {
    return res.status(410).json({
      error: 'Download Limit Reached',
      message: `This transfer reached its maximum allowed downloads (${transfer.downloadLimit}).`,
      code: 'LIMIT_REACHED',
      transfer: {
        subject: transfer.subject,
        senderEmail: transfer.senderEmail,
      },
    });
  }

  res.json({
    id: transfer.id,
    token: transfer.token,
    senderEmail: transfer.senderEmail,
    recipientEmails: transfer.recipientEmails,
    subject: transfer.subject,
    description: transfer.description,
    totalSize: transfer.totalSize,
    createdAt: transfer.createdAt,
    expiresAt: transfer.expiresAt,
    downloadCount: transfer.downloadCount,
    downloadLimit: transfer.downloadLimit,
    status: transfer.status,
    isZip: transfer.files.length > 1 || transfer.files.some((f) => (f.relativePath || '').includes('/')),
    files: transfer.files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      relativePath: f.relativePath,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
      storageUrl: f.storageUrl || null,
    })),
  });
});

/**
 * Download complete transfer
 */
app.get('/api/download/:token', async (req, res) => {
  const { token } = req.params;
  const transfer = await getTransferByToken(token);

  if (!transfer) {
    return res.status(404).send('Transfer not found');
  }

  const now = new Date();
  if (now > new Date(transfer.expiresAt)) {
    return res.status(410).send('This download link has expired.');
  }

  if (transfer.downloadLimit && transfer.downloadCount >= transfer.downloadLimit) {
    return res.status(410).send('Download limit exceeded.');
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';
  await recordDownload(token, ip, userAgent);

  // Single file download
  if (transfer.files.length === 1 && !(transfer.files[0].relativePath || '').includes('/')) {
    const singleFile = transfer.files[0];

    // If using Supabase and storageUrl is available
    if (isSupabaseConfigured() && singleFile.storageKey && !fs.existsSync(getFilePath(singleFile.storageKey))) {
      try {
        const fileBuffer = await supabaseDownloadFileBuffer(singleFile.storageKey);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(singleFile.originalName)}"`);
        res.setHeader('Content-Type', singleFile.mimeType || 'application/octet-stream');
        return res.send(fileBuffer);
      } catch (err) {
        console.error('[Download Single File Error]:', err.message);
        if (singleFile.storageUrl) {
          return res.redirect(singleFile.storageUrl);
        }
      }
    }

    const absolutePath = getFilePath(singleFile.storageKey);
    if (!fs.existsSync(absolutePath)) {
      if (singleFile.storageUrl) return res.redirect(singleFile.storageUrl);
      return res.status(404).send('File missing');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(singleFile.originalName)}"`);
    res.setHeader('Content-Type', singleFile.mimeType || 'application/octet-stream');
    return fs.createReadStream(absolutePath).pipe(res);
  }

  await streamTransferZip(transfer, res);
});

/**
 * Download individual file from transfer
 */
app.get('/api/download/:token/file/:fileId', async (req, res) => {
  const { token, fileId } = req.params;
  const transfer = await getTransferByToken(token);

  if (!transfer) {
    return res.status(404).send('Transfer not found');
  }

  const file = transfer.files.find((f) => f.id === fileId);
  if (!file) {
    return res.status(404).send('File not found in this transfer');
  }

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  await recordDownload(token, ip, req.headers['user-agent'] || '');

  if (isSupabaseConfigured() && file.storageKey && !fs.existsSync(getFilePath(file.storageKey))) {
    try {
      const fileBuffer = await supabaseDownloadFileBuffer(file.storageKey);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      return res.send(fileBuffer);
    } catch (err) {
      console.error('[Download File Error]:', err.message);
      if (file.storageUrl) return res.redirect(file.storageUrl);
    }
  }

  const absolutePath = getFilePath(file.storageKey);
  if (!fs.existsSync(absolutePath)) {
    if (file.storageUrl) return res.redirect(file.storageUrl);
    return res.status(404).send('File missing on disk');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  fs.createReadStream(absolutePath).pipe(res);
});

/**
 * History endpoint: returns past transfers
 */
app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user?.email || '';
    const userId = req.user?.id;
    const history = await getUserTransfers(userId, userEmail);
    res.json({ transfers: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Email Outbox inspection endpoint (Protected - returns only user's emails)
 */
app.get('/api/emails', authMiddleware, (req, res) => {
  const outbox = getEmailOutbox();
  const userEmail = (req.user?.email || '').toLowerCase();

  const userEmails = outbox.filter((e) => {
    const fromMatch = e.from && e.from.toLowerCase().includes(userEmail);
    const toMatch = e.to && (Array.isArray(e.to)
      ? e.to.some((addr) => addr.toLowerCase().includes(userEmail))
      : e.to.toLowerCase().includes(userEmail));
    return fromMatch || toMatch;
  });

  res.json({ emails: userEmails });
});

/**
 * Rendered email HTML endpoint
 */
app.get('/api/emails/:id/html', (req, res) => {
  const email = getEmailById(req.params.id);
  if (!email) {
    return res.status(404).send('Email record not found');
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(email.html);
});

// Serve static files if dist exists (e.g. production build)
const DIST_DIR = path.resolve(__dirname, '../dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
}

export default app;
