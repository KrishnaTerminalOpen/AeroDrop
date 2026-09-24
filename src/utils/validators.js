export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB Client-side file size guard

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function validateRecipientEmails(emails) {
  if (!emails || emails.length === 0) {
    return 'At least one recipient email is required.';
  }
  for (const email of emails) {
    if (!isValidEmail(email)) {
      return `"${email}" is not a valid email address.`;
    }
  }
  return null;
}

export function validateFileSize(files, maxBytes = MAX_FILE_SIZE) {
  if (!files || files.length === 0) {
    return 'Please select at least one file or folder.';
  }
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
  if (totalSize > maxBytes) {
    return `Total transfer size (${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB) exceeds the 2 GB limit.`;
  }
  return null;
}
