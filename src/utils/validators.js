export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
 
export const MAX_FILE_SIZE = Infinity; // No limit file transfer - unlimited capacity

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

export function validateFileSize(files) {
  if (!files || files.length === 0) {
    return 'Please select at least one file or folder.';
  }
  // Unlimited file transfer size - no restriction
  return null;
}
