import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { generateEmailHtml } from './emailTemplate.js';

// In-memory outbox log for tracking and inspection
const sentEmailsOutbox = [];

/**
 * Helper to build a Nodemailer transporter
 */
function createSmtpTransporter({ smtpHost, smtpUser, smtpPass, smtpPort, smtpSecure }) {
  const cleanPass = (smtpPass || '').trim().replace(/\s+/g, '');
  const isGmail = smtpHost === 'smtp.gmail.com' || process.env.SMTP_SERVICE === 'gmail' || smtpUser?.endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: cleanPass,
      },
    });
  }

  return nodemailer.createTransport({
    host: smtpHost || 'smtp.gmail.com',
    port: parseInt(smtpPort || '587', 10),
    secure: smtpSecure === 'true' || smtpSecure === true,
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Send transactional email using real email providers:
 * Priority 1: SMTP if configured or explicitly preferred (Gmail App Password, SES, Postmark) - sends to ANY email
 * Priority 2: Resend (Official SDK via RESEND_API_KEY)
 * Priority 3: SendGrid (via SENDGRID_API_KEY)
 */
export async function sendTransferEmail({
  transfer,
  downloadUrl,
}) {
  const results = [];
  const senderDisplay = transfer.senderEmail || 'transfers@aerodrop.local';

  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST || (process.env.SMTP_USER?.endsWith('@gmail.com') ? 'smtp.gmail.com' : '');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT || '587';
  const smtpSecure = process.env.SMTP_SECURE;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  const hasSmtp = Boolean(smtpUser && smtpPass);
  const hasResend = Boolean(resendApiKey);
  const hasSendgrid = Boolean(sendgridApiKey);

  // Determine primary provider
  // If SMTP is configured, we prefer SMTP because Resend test domain blocks arbitrary recipients
  let primaryProvider = 'resend';
  if (emailProvider === 'smtp' || (hasSmtp && (!hasResend || process.env.PREFER_SMTP === 'true' || emailProvider !== 'resend'))) {
    primaryProvider = 'smtp';
  } else if (hasResend) {
    primaryProvider = 'resend';
  } else if (hasSmtp) {
    primaryProvider = 'smtp';
  } else if (hasSendgrid) {
    primaryProvider = 'sendgrid';
  }

  const fromEmail = process.env.EMAIL_FROM || (
    primaryProvider === 'smtp' && smtpUser
      ? `"AeroDrop Transfers" <${smtpUser}>`
      : 'AeroDrop Transfers <onboarding@resend.dev>'
  );

  // Verify that a real provider is configured
  if (!hasResend && !hasSmtp && !hasSendgrid) {
    const errorMsg = 'No transactional email provider configured. Please configure Gmail SMTP (SMTP_USER & SMTP_PASS) or RESEND_API_KEY in your .env file.';
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
    let deliveryError = null;

    // Helper: Send via SMTP
    const sendViaSmtp = async () => {
      const transporter = createSmtpTransporter({ smtpHost, smtpUser, smtpPass, smtpPort, smtpSecure });
      console.log(`[EmailService] Dispatching email via SMTP (${smtpHost || 'gmail'}) to ${recipient}...`);
      const info = await transporter.sendMail({
        from: fromEmail.includes('<') ? fromEmail : `"AeroDrop Transfers" <${smtpUser}>`,
        to: recipient,
        replyTo: senderDisplay,
        subject: `[AeroDrop] ${transfer.subject}`,
        html: htmlContent,
        text: plainText,
      });
      return { messageId: info.messageId, provider: 'SMTP' };
    };

    // Helper: Send via Resend
    const sendViaResend = async () => {
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
        throw error;
      }
      return { messageId: data?.id, provider: 'Resend' };
    };

    // Attempt delivery based on primary provider
    try {
      if (primaryProvider === 'smtp' && hasSmtp) {
        const res = await sendViaSmtp();
        messageId = res.messageId;
        providerUsed = res.provider;
        console.log(`[EmailService] SMTP email sent successfully! Message ID: ${messageId}`);
      } else if (primaryProvider === 'resend' && hasResend) {
        try {
          const res = await sendViaResend();
          messageId = res.messageId;
          providerUsed = res.provider;
          console.log(`[EmailService] Resend email sent successfully! Message ID: ${messageId}`);
        } catch (resendErr) {
          const errMsg = resendErr?.message || JSON.stringify(resendErr);
          const isRestrictedDomain = errMsg.includes('only send testing emails') || resendErr?.statusCode === 403;

          // If Resend failed because recipient is not verified and we have SMTP credentials, auto-fallback to SMTP
          if (isRestrictedDomain && hasSmtp) {
            console.warn(`[EmailService] Resend blocked external recipient (${recipient}). Falling back to SMTP...`);
            const res = await sendViaSmtp();
            messageId = res.messageId;
            providerUsed = res.provider + ' (Resend Fallback)';
            console.log(`[EmailService] Fallback SMTP email sent successfully! Message ID: ${messageId}`);
          } else if (isRestrictedDomain) {
            throw new Error(`Resend Free Sandbox Restriction: onboarding@resend.dev can only send to your verified account email. To send to ${recipient} or any recipient, add Gmail SMTP credentials (SMTP_USER and SMTP_PASS) to .env, or verify your domain at resend.com/domains.`);
          } else {
            throw resendErr;
          }
        }
      } else if (hasSendgrid) {
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
          throw new Error(`SendGrid delivery failed: ${sgErr}`);
        }

        messageId = sgResponse.headers.get('x-message-id') || 'sg_' + Date.now();
        console.log(`[EmailService] SendGrid email sent successfully! Message ID: ${messageId}`);
      }
    } catch (err) {
      console.error(`[EmailService Delivery Error for ${recipient}]:`, err.message || err);
      deliveryError = err.message || 'Delivery failed';
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
      messageId: messageId || null,
      provider: providerUsed || primaryProvider,
      status: deliveryError ? 'failed' : 'delivered',
      error: deliveryError || null,
    };

    sentEmailsOutbox.unshift(emailRecord);
    results.push(emailRecord);

    if (deliveryError && transfer.recipientEmails.length === 1) {
      throw new Error(deliveryError);
    }
  }

  return results;
}

export function getEmailOutbox() {
  return sentEmailsOutbox;
}

export function getEmailById(id) {
  return sentEmailsOutbox.find((e) => e.id === id);
}
