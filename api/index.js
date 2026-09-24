import app from '../server/index.js';

export default async function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Error]:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Serverless execution error',
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      });
    }
  }
}
