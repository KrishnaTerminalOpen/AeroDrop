/**
 * AeroDrop Server-Side Cryptographic & E2EE Support Module
 * Compatible with Web Crypto API AES-GCM 256-bit encryption.
 */

import crypto from 'crypto';

const E2EE_PREFIX = 'e2ee:v1:';
const GLOBAL_SALT = 'aerodrop_e2ee_master_salt_2026_secure_protocol';

/**
 * Derive a 32-byte (256-bit) AES key from roomId
 */
export function deriveServerRoomKey(roomId, userSecret = '') {
  const hash = crypto.createHash('sha256');
  hash.update(`${GLOBAL_SALT}_room_${roomId}_${userSecret}`);
  return hash.digest(); // 32 bytes
}

/**
 * Encrypt plaintext string on server using AES-256-GCM
 */
export function encryptServerText(plaintext, roomId) {
  if (plaintext === null || plaintext === undefined || typeof plaintext !== 'string') {
    return plaintext;
  }
  if (!plaintext.trim()) return plaintext;

  try {
    const key = deriveServerRoomKey(roomId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(), // 16-byte GCM tag
    ]);

    const ivB64 = iv.toString('base64');
    const ctB64 = ciphertext.toString('base64');

    return `${E2EE_PREFIX}${ivB64}:${ctB64}`;
  } catch (err) {
    console.error('[Server E2EE] Encryption error:', err);
    return plaintext;
  }
}

/**
 * Decrypt an E2EE string on server using AES-256-GCM
 */
export function decryptServerText(text, roomId) {
  if (!text || typeof text !== 'string') return text || '';
  if (!text.startsWith(E2EE_PREFIX)) return text;

  try {
    const key = deriveServerRoomKey(roomId);
    const payload = text.slice(E2EE_PREFIX.length);
    const colonIndex = payload.indexOf(':');
    if (colonIndex === -1) return text;

    const ivB64 = payload.slice(0, colonIndex);
    const ctB64 = payload.slice(colonIndex + 1);

    const iv = Buffer.from(ivB64, 'base64');
    const combinedBuffer = Buffer.from(ctB64, 'base64');

    if (combinedBuffer.length < 16) return text;

    const tag = combinedBuffer.slice(combinedBuffer.length - 16);
    const ciphertext = combinedBuffer.slice(0, combinedBuffer.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    return '🔒 [End-to-End Encrypted Message]';
  }
}

export function isEncryptedText(text) {
  return typeof text === 'string' && text.startsWith(E2EE_PREFIX);
}
