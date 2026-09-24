import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { generateEmailHtml } from './emailTemplate.js';

// In-memory outbox log for tracking and inspection
const sentEmailsOutbox = [];

/**
 * Send transactional email using real email providers:
 * Priority 1: Resend (Official SDK via RESEND_API_KEY)
 * Priority 2: SMTP / SES / Postmark / Gmail App Password (via SMTP_HOST, SMTP_USER, SMTP_PASS)
 * Priority 3: SendGrid (via SENDGRID_API_KEY)
 */
export async function sendTransferEmail({
  transfer,
  downloadUrl,
}) {
  const results = [];
  const senderDisplay = transfer.senderEmail || 'transfers@aerodrop.local';

  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  const fromEmail = process.env.EMAIL_FROM || (resendApiKey ? 'AeroDrop Transfers <onboarding@resend.dev>' : `"AeroDrop Transfers" <${smtpUser || 'transfers@aerodrop.local'}>`);

  // Verify that a real provider is configured
  if (!resendApiKey && !smtpUser && !sendgridApiKey) {
    const errorMsg = 'No real email provider configured. Please set RESEND_API_KEY or SMTP credentials in your .env file.';
    console.error(`[EmailService Error]: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  for (const recipient of transfer.recipientEmails) {
    const htmlContent = generateEmailHtml({
      senderEmail: senderDisplay,
      recipientEmail: recipient,
      subject: transfer.subject,
      description: transfer.description,
      files: transfer.files,
      totalSize: transfer.totalSize,
      downloadUrl,
      expiresAt: transfer.expiresAt,
      expiryDays: transfer.expiryDays,
    });

    const plainText = `${senderDisplay} sent you files via AeroDrop!\n\nSubject: ${transfer.subject}\nMessage: ${transfer.description || 'No message provided'}\n\nDownload Link: ${downloadUrl}\nTotal Size: ${transfer.totalSize} bytes\nExpires at: ${transfer.expiresAt}\n\nDownload your files securely using the link above.`;

    let messageId = null;
    let providerUsed = '';

    // 1. Resend official API SDK
    if (resendApiKey) {
      providerUsed = 'Resend';
      const resend = new Resend(resendApiKey);

      console.log(`[EmailService] Dispatching email via Resend to ${recipient}...`);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [recipient],
        replyTo: senderDisplay,
        subject: `[AeroDrop] ${transfer.subject}`,
        html: htmlContent,
        text: plainText,
      });

      if (error) {
        console.error(`[EmailService Resend Error]`, error);
        throw new Error(`Resend delivery failed for ${recipient}: ${error.message || JSON.stringify(error)}`);
      }

      messageId = data?.id;
      console.log(`[EmailService] Resend email sent successfully! Message ID: ${messageId}`);
    }
    // 2. SMTP (Gmail, Amazon SES, Postmark SMTP, custom relay)
    else if (smtpHost && smtpUser && smtpPass) {
      providerUsed = 'SMTP';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      console.log(`[EmailService] Dispatching email via SMTP (${smtpHost}) to ${recipient}...`);
      const info = await transporter.sendMail({
        from: fromEmail,
        to: recipient,
        replyTo: senderDisplay,
        subject: `[AeroDrop] ${transfer.subject}`,
        html: htmlContent,
        text: plainText,
      });

      messageId = info.messageId;
      console.log(`[EmailService] SMTP email sent successfully! Message ID: ${messageId}`);
    }
    // 3. SendGrid
    else if (sendgridApiKey) {
      providerUsed = 'SendGrid';
      console.log(`[EmailService] Dispatching email via SendGrid to ${recipient}...`);
      const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: process.env.EMAIL_FROM || 'transfers@aerodrop.local', name: 'AeroDrop Transfers' },
          reply_to: { email: senderDisplay },
          subject: `[AeroDrop] ${transfer.subject}`,
          content: [
            { type: 'text/plain', value: plainText },
            { type: 'text/html', value: htmlContent },
          ],
        }),
      });

      if (!sgResponse.ok) {
        const sgErr = await sgResponse.text();
        console.error(`[EmailService SendGrid Error]:`, sgErr);
        throw new Error(`SendGrid delivery failed: ${sgErr}`);
      }

      messageId = sgResponse.headers.get('x-message-id') || 'sg_' + Date.now();
      console.log(`[EmailService] SendGrid email sent successfully! Message ID: ${messageId}`);
    }

    const emailRecord = {
      id: 'em_' + Math.random().toString(36).substring(2, 9),
      transferId: transfer.id,
      token: transfer.token,
      from: fromEmail,
      to: recipient,
      subject: transfer.subject,
      description: transfer.description,
      html: htmlContent,
      sentAt: new Date().toISOString(),
      messageId,
      provider: providerUsed,
      status: 'delivered',
    };

    sentEmailsOutbox.unshift(emailRecord);
    results.push(emailRecord);
  }

  return results;
}

export function getEmailOutbox() {
  return sentEmailsOutbox;
}

export function getEmailById(id) {
  return sentEmailsOutbox.find((e) => e.id === id);
}
