/**
 * Format bytes into human readable format (KB, MB, GB)
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Minimal, clean HTML email template for file sharing.
 * Keeps only: Subject, Description (if present), File list, and Download button.
 */
export function generateEmailHtml({
  senderEmail,
  recipientEmail,
  subject,
  description,
  files,
  totalSize,
  downloadUrl,
  expiresAt,
  expiryDays,
}) {
  const fileRowsHtml = files
    .slice(0, 10)
    .map(
      (file) => `
      <tr>
        <td style="padding: 8px 14px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">
          <span style="display: inline-block; vertical-align: middle; margin-right: 8px;">📄</span>
          ${file.relativePath || file.originalName}
        </td>
        <td style="padding: 8px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; text-align: right; white-space: nowrap;">
          ${formatBytes(file.sizeBytes)}
        </td>
      </tr>
    `
    )
    .join('');

  const remainingFilesCount = files.length > 10 ? files.length - 10 : 0;
  const remainingFilesHtml =
    remainingFilesCount > 0
      ? `<tr><td colspan="2" style="padding: 6px 14px; font-size: 12px; color: #94a3b8; text-align: center; font-style: italic;">+ ${remainingFilesCount} more file(s)</td></tr>`
      : '';

  const formattedDescription = description
    ? description.replace(/\n/g, '<br/>')
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Header: Brand + Subject -->
          <tr>
            <td style="padding: 24px 28px 20px 28px;">
              <div style="font-size: 14px; font-weight: 700; color: #4f46e5; letter-spacing: -0.3px; margin-bottom: 14px;">
                ⚡ AeroDrop
              </div>
              <h1 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.3;">
                ${subject}
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0;">
                from ${senderEmail}
              </p>
            </td>
          </tr>

          <!-- Description (only if provided) -->
          ${
            description
              ? `
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="background-color: #f8fafc; border-left: 3px solid #4f46e5; border-radius: 0 8px 8px 0; padding: 12px 16px; font-size: 14px; color: #334155; line-height: 1.6;">
                ${formattedDescription}
              </div>
            </td>
          </tr>
          `
              : ''
          }

          <!-- File List -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px;">
                ${files.length} ${files.length === 1 ? 'file' : 'files'} · ${formatBytes(totalSize)}
              </div>
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  ${fileRowsHtml}
                  ${remainingFilesHtml}
                </table>
              </div>
            </td>
          </tr>

          <!-- Download Button -->
          <tr>
            <td style="padding: 0 28px 28px 28px;" align="center">
              <a href="${downloadUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-align: center;">
                📥 Download Files
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                Powered by AeroDrop
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Clean, branded HTML email template for One-Time Password (OTP) verification
 */
export function generateOtpEmailHtml({ otpCode, recipientEmail }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AeroDrop Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); text-align: center;">
              <div style="display: inline-block; width: 44px; height: 44px; background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); border-radius: 12px; line-height: 44px; font-size: 22px; color: #ffffff; text-align: center; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                ✈️
              </div>
              <h1 style="margin: 0 0 4px 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
                AeroDrop Verification
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                Instant, secure sign-in verification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <p style="margin: 0 0 12px 0; font-size: 15px; color: #334155; line-height: 1.5;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.5;">
                Use the 6-digit verification code below to sign in to your AeroDrop account for <strong>${recipientEmail}</strong>:
              </p>

              <!-- OTP Code Box -->
              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 22px 16px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
                  Your One-Time Code
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #4f46e5; letter-spacing: 8px; line-height: 1;">
                  ${otpCode}
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  ⏱ <strong>Expires in 10 minutes.</strong> Never share this code with anyone. AeroDrop staff will never ask for your code.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If you did not request this verification code, please ignore this email or change your password if you suspect unauthorized activity.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">
                Powered by <strong>AeroDrop</strong> • Secure Fast File Sharing & Chat
              </p>
              <p style="font-size: 11px; color: #cbd5e1; margin: 0;">
                This is an automated security email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

