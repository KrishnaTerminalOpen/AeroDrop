import express from 'express';
import http from 'http';
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
  getTransfersDB,
} from './storage.js';
import { sendTransferEmail, getEmailOutbox, getEmailById } from './emailService.js';
import { rateLimiterMiddleware, scanFileForThreats } from './rateLimiter.js';
import chatRoutes from './chatRoutes.js';
import { setupSocketServer } from './socketServer.js';

const __filename = fileURLToPath(import.meta.url);
const isVercel = Boolean(process.env.VERCEL);
const UPLOADS_DIR = isVercel ? '/tmp/data/uploads' : path.resolve(__dirname, '../data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount chat & auth routes
app.use('/api', chatRoutes);

// Configure multer for disk storage
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

// 2GB client and server side upload limit as specified in PDF
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
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * Provider status check
 */
app.get('/api/provider-status', (req, res) => {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);

  let activeProvider = 'none';
  if (hasResend) activeProvider = 'resend';
  else if (hasSmtp) activeProvider = 'smtp';
  else if (hasSendGrid) activeProvider = 'sendgrid';

  res.json({
    activeProvider,
    hasResend,
    hasSmtp,
    hasSendGrid,
    fromEmail: process.env.EMAIL_FROM || (hasResend ? 'onboarding@resend.dev' : process.env.SMTP_USER || 'none'),
  });
});

/**
 * Upload Endpoint: handles multi-file and folder upload
 */
app.post(
  '/api/upload',
  rateLimiterMiddleware,
  upload.array('files'),
  async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
      }

      const {
        senderEmail,
        recipientEmails,
        subject,
        description,
        expiryDays,
        downloadLimit,
        relativePaths,
      } = req.body;

      // Parse recipient emails
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

      // Parse relative paths if provided (for folder uploads with webkitdirectory)
      let parsedPaths = [];
      if (relativePaths) {
        try {
          parsedPaths = typeof relativePaths === 'string' ? JSON.parse(relativePaths) : relativePaths;
        } catch (e) {
          parsedPaths = [];
        }
      }

      // Attach relative path to file objects
      files.forEach((file, index) => {
        if (parsedPaths[index]) {
          file.relativePath = parsedPaths[index];
        } else {
          file.relativePath = file.originalname;
        }
      });

      // Threat / virus scanning hook
      for (const file of files) {
        const scan = await scanFileForThreats(file);
        if (!scan.safe) {
          // Clean up uploaded files
          files.forEach((f) => {
            try {
              fs.unlinkSync(f.path);
            } catch (err) {}
          });
          return res.status(400).json({
            error: 'Security scan rejected file',
            reason: scan.reason,
            fileName: file.originalname,
          });
        }
      }

      // Create transfer record in database
      const transfer = createTransfer({
        senderEmail,
        recipientEmails: recipients,
        subject: subject || 'Files shared via AeroDrop',
        description: description || '',
        files,
        expiryDays: expiryDays ? parseInt(expiryDays, 10) : 7,
        downloadLimit: downloadLimit ? parseInt(downloadLimit, 10) : null,
      });

      // Construct download URL
      const host = req.get('host');
      const protocol = req.protocol;
      // In dev, the frontend runs on port 3000
      const origin = req.get('origin') || `${protocol}://${host}`;
      const downloadUrl = `${origin}/#download/${transfer.token}`;

      // Dispatch instant transactional email via real provider API
      let emailResults = [];
      try {
        emailResults = await sendTransferEmail({
          transfer,
          downloadUrl,
        });
      } catch (mailErr) {
        console.error('[Upload Handler] Email delivery failed:', mailErr);
        // Step 5: Do NOT show "Sent successfully" if email API call fails!
        return res.status(502).json({
          error: 'Email delivery failed',
          message: mailErr.message || 'The email provider failed to deliver the transfer email.',
          details: 'Please check your API key, verified sender domain, and recipient address.',
        });
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
        },
        emailsDispatched: emailResults.length,
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
app.get('/api/transfers/:token', (req, res) => {
  const { token } = req.params;
  const transfer = getTransferByToken(token);

  if (!transfer) {
    return res.status(404).json({
      error: 'Transfer not found',
      message: 'This link may have been deleted, never existed, or is incorrect.',
      code: 'NOT_FOUND',
    });
  }

  // Check if expired
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

  // Check download limit if configured
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
    isZip: transfer.files.length > 1 || transfer.files.some((f) => f.relativePath.includes('/')),
    files: transfer.files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      relativePath: f.relativePath,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
    })),
  });
});

/**
 * Download complete transfer (ZIP if folder or multi-file, or raw file if single file)
 */
app.get('/api/download/:token', (req, res) => {
  const { token } = req.params;
  const transfer = getTransferByToken(token);

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

  // Track download
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';
  recordDownload(token, ip, userAgent);

  // If single file and not in folder structure, stream directly
  if (transfer.files.length === 1 && !transfer.files[0].relativePath.includes('/')) {
    const singleFile = transfer.files[0];
    const absolutePath = getFilePath(singleFile.storageKey);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send('File missing on disk');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(singleFile.originalName)}"`);
    res.setHeader('Content-Type', singleFile.mimeType || 'application/octet-stream');
    return fs.createReadStream(absolutePath).pipe(res);
  }

  // Otherwise, create ZIP archive and stream
  streamTransferZip(transfer, res);
});

/**
 * Download individual file from transfer
 */
app.get('/api/download/:token/file/:fileId', (req, res) => {
  const { token, fileId } = req.params;
  const transfer = getTransferByToken(token);

  if (!transfer) {
    return res.status(404).send('Transfer not found');
  }

  const file = transfer.files.find((f) => f.id === fileId);
  if (!file) {
    return res.status(404).send('File not found in this transfer');
  }

  const absolutePath = getFilePath(file.storageKey);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).send('File missing on disk');
  }

  // Track download
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  recordDownload(token, ip, req.headers['user-agent'] || '');

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  fs.createReadStream(absolutePath).pipe(res);
});

/**
 * History endpoint: returns past transfers
 */
app.get('/api/history', (req, res) => {
  const db = getTransfersDB();
  const now = new Date();

  // Map and update expired statuses
  const history = db.transfers.map((t) => {
    const isExpired = now > new Date(t.expiresAt);
    return {
      id: t.id,
      token: t.token,
      senderEmail: t.senderEmail,
      recipientEmails: t.recipientEmails,
      subject: t.subject,
      description: t.description,
      fileCount: t.files.length,
      totalSize: t.totalSize,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      downloadCount: t.downloadCount,
      downloadLimit: t.downloadLimit,
      status: isExpired ? 'expired' : t.status,
      filesSummary: t.files.slice(0, 3).map((f) => f.originalName),
    };
  });

  res.json({ transfers: history });
});

/**
 * Email Outbox inspection endpoint (for verifying instant transactional email)
 */
app.get('/api/emails', (req, res) => {
  const outbox = getEmailOutbox();
  res.json({ emails: outbox });
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

const httpServer = http.createServer(app);
setupSocketServer(httpServer);

if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 AeroDrop server running on http://localhost:${PORT}`);
  });
}

export default app;
export { app, httpServer };

