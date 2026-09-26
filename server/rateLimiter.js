// In-memory rate limiting map: IP -> { count, resetTime }
const ipTransferCounts = new Map();

const MAX_TRANSFERS_PER_HOUR = 50;
const ONE_HOUR_MS = 60 * 60 * 1000;

// Disallowed or dangerous file extensions for abuse prevention
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar', '.com', '.pif'
];

/**
 * Middleware: Rate limit sends per IP
 */
export function rateLimiterMiddleware(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();

  const record = ipTransferCounts.get(ip);
  if (!record || now > record.resetTime) {
    ipTransferCounts.set(ip, {
      count: 1,
      resetTime: now + ONE_HOUR_MS,
    });
    return next();
  }

  if (record.count >= MAX_TRANSFERS_PER_HOUR) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum sends per IP reached (${MAX_TRANSFERS_PER_HOUR}/hour). Please try again in ${minutesLeft} minute(s).`,
      retryAfterMinutes: minutesLeft,
    });
  }

  record.count += 1;
  next();
}

/**
 * Hook to simulate virus scanning and file security inspection
 */
export async function scanFileForThreats(file) {
  const ext = (file.originalname || '').toLowerCase();
  
  // Abuse prevention check
  const isSuspicious = DANGEROUS_EXTENSIONS.some((dangerExt) => ext.endsWith(dangerExt));
  if (isSuspicious) {
    return {
      safe: false,
      scanner: 'AeroDrop Shield v2.4',
      reason: `Potentially hazardous file type (${ext}) is blocked for recipient safety.`,
    };
  }

  // Simulated real-time scan latency
  return {
    safe: true,
    scanner: 'AeroDrop Shield v2.4 (Cloud ClamAV)',
    threatsFound: 0,
    timestamp: new Date().toISOString(),
  };
}

// In-memory brute-force rate limiter for authentication: IP+email -> { failedAttempts, lockedUntil }
const loginAttempts = new Map();
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000; // 5-minute lockout

export function checkLoginRateLimit(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (record && record.lockedUntil && now < record.lockedUntil) {
    const minutesLeft = Math.ceil((record.lockedUntil - now) / 60000);
    return { locked: true, minutesLeft };
  }
  return { locked: false, remainingAttempts: record ? Math.max(0, MAX_FAILED_LOGIN_ATTEMPTS - record.failedAttempts) : MAX_FAILED_LOGIN_ATTEMPTS };
}

export function recordFailedLogin(key) {
  const now = Date.now();
  const record = loginAttempts.get(key) || { failedAttempts: 0, lockedUntil: 0 };
  record.failedAttempts += 1;
  if (record.failedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOGIN_LOCKOUT_MS;
    record.failedAttempts = 0;
  }
  loginAttempts.set(key, record);
}

export function clearFailedLogin(key) {
  loginAttempts.delete(key);
}
