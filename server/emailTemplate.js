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
 * Clean, branded HTML email template for file sharing
 * Conforms to PDF Page 4 specifications:
 * - Subject
 * - Sender's description (with line breaks)
 * - Prominent "Download Files" button
 * - File name/size summary table
 * - Expiry notice
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
  const expiryDateFormatted = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const fileRowsHtml = files
    .slice(0, 10)
    .map(
      (file) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 500;">
          <span style="display: inline-block; vertical-align: middle; margin-right: 8px;">📄</span>
          ${file.relativePath || file.originalName}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; text-align: right; white-space: nowrap;">
          ${formatBytes(file.sizeBytes)}
        </td>
      </tr>
    `
    )
    .join('');

  const remainingFilesCount = files.length > 10 ? files.length - 10 : 0;
  const remainingFilesHtml =
    remainingFilesCount > 0
      ? `<tr><td colspan="2" style="padding: 8px 14px; font-size: 12px; color: #94a3b8; text-align: center; font-style: italic;">+ ${remainingFilesCount} more file(s)</td></tr>`
      : '';

  const formattedDescription = description
    ? description.replace(/\n/g, '<br/>')
    : 'No additional message provided.';

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
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); overflow: hidden;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; display: inline-flex; align-items: center; gap: 8px;">
                      ⚡ AeroDrop
                    </span>
                  </td>
                  <td align="right">
                    <span style="background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Secure Transfer
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 600; margin: 16px 0 4px 0; line-height: 1.3;">
                ${subject}
              </h1>
              <p style="color: rgba(255, 255, 255, 0.85); font-size: 14px; margin: 0;">
                Sent by <strong style="color: #ffffff;">${senderEmail}</strong>
              </p>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              ${
                description
                  ? `
                <div style="margin-bottom: 24px;">
                  <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin: 0 0 8px 0;">
                    Message from sender
                  </p>
                  <div style="background-color: #f8fafc; border-left: 3px solid #4f46e5; border-radius: 0 8px 8px 0; padding: 14px 18px; font-size: 15px; color: #334155; line-height: 1.6;">
                    ${formattedDescription}
                  </div>
                </div>
              `
                  : ''
              }

              <!-- Summary Card -->
              <div style="margin-bottom: 28px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                  <tr>
                    <td>
                      <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b;">
                        Attached Files (${files.length})
                      </span>
                    </td>
                    <td align="right">
                      <span style="font-size: 12px; font-weight: 600; color: #475569;">
                        Total: ${formatBytes(totalSize)}
                      </span>
                    </td>
                  </tr>
                </table>

                <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    ${fileRowsHtml}
                    ${remainingFilesHtml}
                  </table>
                </div>
              </div>

              <!-- Primary CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 15px 36px; border-radius: 10px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.35); text-align: center; transition: all 0.2s ease;">
                      📥 Download Files (${formatBytes(totalSize)})
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notice -->
              <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
                  ⏱ <strong>Expiry Notice:</strong> This link is secure and will expire on <strong>${expiryDateFormatted}</strong> (${expiryDays} days).
                </p>
              </div>

              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
                Button not working? Copy and paste this link into your browser:<br/>
                <a href="${downloadUrl}" style="color: #4f46e5; word-break: break-all; text-decoration: underline;">${downloadUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">
                Powered by <strong>AeroDrop</strong> • Instant Email File & Folder Sharing
              </p>
              <p style="font-size: 11px; color: #cbd5e1; margin: 0;">
                Encrypted in transit. Scanned for viruses and threats.
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
