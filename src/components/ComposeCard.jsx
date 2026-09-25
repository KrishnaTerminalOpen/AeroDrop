import React, { useState, useEffect } from 'react';
import { User, MessageSquare, Tag, AlertCircle } from 'lucide-react';
import RecipientChipInput from './RecipientChipInput';
import Dropzone from './Dropzone';
import SendButton from './SendButton';
import UploadProgress from './UploadProgress';
import TransferSuccess from './TransferSuccess';
import { isValidEmail, validateRecipientEmails, validateFileSize } from '../utils/validators';

export default function ComposeCard({
  defaultSenderEmail = '',
  defaultExpiryDays = 7,
  defaultDownloadLimit = null,
  onTransferCreated,
  onOpenLandingPage,
  onViewEmail,
  showToast,
}) {
  const [recipientEmails, setRecipientEmails] = useState([]);
  const [senderEmail, setSenderEmail] = useState(defaultSenderEmail);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);

  // Errors
  const [recipientError, setRecipientError] = useState(null);
  const [senderError, setSenderError] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  // Focus states for animated border glow / label float
  const [focusedField, setFocusedField] = useState(null);

  // Upload & submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [overallStatus, setOverallStatus] = useState('uploading');
  const [createdTransfer, setCreatedTransfer] = useState(null);

  // Sync default sender email if changed in settings
  useEffect(() => {
    if (defaultSenderEmail && !senderEmail) {
      setSenderEmail(defaultSenderEmail);
    }
  }, [defaultSenderEmail]);

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // Validate recipients
    const recError = validateRecipientEmails(recipientEmails);
    if (recError) {
      setRecipientError(recError);
      showToast({ type: 'error', title: 'Invalid Recipients', message: recError });
      return;
    }

    // Validate sender email
    if (senderEmail && !isValidEmail(senderEmail)) {
      setSenderError('Please provide a valid sender email.');
      showToast({ type: 'error', title: 'Invalid Sender Email', message: 'Please enter a valid sender email.' });
      return;
    }

    // Validate files
    const fError = validateFileSize(files);
    if (fError) {
      setFileError(fError);
      showToast({ type: 'error', title: 'No Files Attached', message: fError });
      return;
    }

    // Clear previous errors
    setRecipientError(null);
    setSenderError(null);
    setFileError(null);
    setSubmissionError(null);

    setIsSubmitting(true);
    setUploadProgress(5);
    setOverallStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('recipientEmails', JSON.stringify(recipientEmails));
      formData.append('senderEmail', senderEmail || defaultSenderEmail || 'anonymous@aerodrop.local');
      formData.append('subject', subject || 'Files shared via AeroDrop');
      formData.append('description', description);
      formData.append('expiryDays', defaultExpiryDays.toString());
      if (defaultDownloadLimit) {
        formData.append('downloadLimit', defaultDownloadLimit.toString());
      }

      // Collect relative paths for folder uploads
      const relativePaths = files.map((f) => f.relativePath || f.name);
      formData.append('relativePaths', JSON.stringify(relativePaths));

      files.forEach((file) => {
        formData.append('files', file);
      });

      // Simulated smooth progress while sending
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressTimer);
            return 88;
          }
          return prev + Math.floor(Math.random() * 15 + 8);
        });
      }, 150);

      // Perform upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      // Progress animation phase 2: zipping
      setUploadProgress(95);
      setOverallStatus('zipping');

      const data = await response.json();

      setTimeout(() => {
        setUploadProgress(100);
        setOverallStatus('completed');
        setIsSuccess(true);

        if (data.emailWarning) {
          showToast({
            type: 'warning',
            title: 'Files Uploaded (Email Alert)',
            message: 'Files uploaded! Notice: ' + data.emailWarning,
            duration: 8000,
          });
        } else {
          showToast({
            type: 'success',
            title: 'Email Sent!',
            message: `Transactional email sent to ${recipientEmails.join(', ')}`,
          });
        }

        // After checkmark morph, display success confirmation screen
        setTimeout(() => {
          setIsSubmitting(false);
          setCreatedTransfer(data.transfer);
          if (onTransferCreated) {
            onTransferCreated(data.transfer);
          }
        }, 600);
      }, 400);
    } catch (err) {
      setIsSubmitting(false);
      setIsSuccess(false);
      setUploadProgress(0);
      const errMsg = err.message || 'An unexpected network error occurred.';
      setSubmissionError(errMsg);
      showToast({
        type: 'error',
        title: 'Delivery Failed',
        message: errMsg,
      });
    }
  };

  const resetForm = () => {
    setRecipientEmails([]);
    setSubject('');
    setDescription('');
    setFiles([]);
    setIsSubmitting(false);
    setIsSuccess(false);
    setUploadProgress(0);
    setCreatedTransfer(null);
  };

  if (createdTransfer) {
    return (
      <div style={{ maxWidth: '680px', width: '100%', margin: '0 auto' }}>
        <TransferSuccess
          transfer={createdTransfer}
          onReset={resetForm}
          onViewEmail={onViewEmail}
          onOpenLandingPage={onOpenLandingPage}
        />
      </div>
    );
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        padding: '32px 30px',
        transition: 'background-color 300ms ease, border-color 300ms ease',
      }}
    >
      {/* Header bar within compose card */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.4px',
              color: 'var(--text-main)',
            }}
          >
            Send Files via Email
          </h1>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              padding: '4px 10px',
              borderRadius: '999px',
            }}
          >
            {defaultExpiryDays} Days Expiry
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-placeholder)', marginTop: '4px' }}>
          Recipients get a clean transactional email with an instant, secure download link.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Recipient Input (Chip Input with validation) */}
        <div className="animate-fade-up stagger-1">
          <RecipientChipInput
            emails={recipientEmails}
            setEmails={setRecipientEmails}
            error={recipientError}
            setError={setRecipientError}
          />
        </div>

        {/* Sender Email (Optional if auto-filled or remembered) */}
        <div className="animate-fade-up stagger-2" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: focusedField === 'sender' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 200ms ease',
            }}
          >
            <User size={14} />
            <span>Your Email (Sender)</span>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-placeholder)' }}>
              (Optional — recipients can reply to this)
            </span>
          </label>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => {
              setSenderEmail(e.target.value);
              if (senderError) setSenderError(null);
            }}
            onFocus={() => setFocusedField('sender')}
            onBlur={() => setFocusedField(null)}
            placeholder="you@example.com"
            style={{
              height: '46px',
              padding: '0 14px',
              borderRadius: '10px',
              border: `1.5px solid ${
                senderError
                  ? 'var(--color-error)'
                  : focusedField === 'sender'
                  ? 'var(--border-focus)'
                  : 'var(--border-subtle)'
              }`,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '14px',
              outline: 'none',
              boxShadow:
                focusedField === 'sender'
                  ? senderError
                    ? '0 0 0 3px rgba(239, 68, 68, 0.2)'
                    : 'var(--shadow-glow)'
                  : 'none',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
          />
          {senderError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-error)', fontSize: '12px' }}>
              <AlertCircle size={14} />
              <span>{senderError}</span>
            </div>
          )}
        </div>

        {/* Subject Field */}
        <div className="animate-fade-up stagger-3" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: focusedField === 'subject' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 200ms ease',
            }}
          >
            <Tag size={14} />
            <span>Subject</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setFocusedField('subject')}
            onBlur={() => setFocusedField(null)}
            placeholder="What are you sharing? (e.g. Project Assets Q3, Pitch Deck)"
            style={{
              height: '46px',
              padding: '0 14px',
              borderRadius: '10px',
              border: `1.5px solid ${
                focusedField === 'subject' ? 'var(--border-focus)' : 'var(--border-subtle)'
              }`,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '14px',
              outline: 'none',
              boxShadow: focusedField === 'subject' ? 'var(--shadow-glow)' : 'none',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
          />
        </div>

        {/* Description / Message (Rich-ish textarea with line breaks) */}
        <div className="animate-fade-up stagger-4" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: focusedField === 'description' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 200ms ease',
            }}
          >
            <MessageSquare size={14} />
            <span>Message / Description</span>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-placeholder)' }}>
              (Included in the recipient's email)
            </span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
            placeholder="Add an optional note or instructions for the recipient..."
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: `1.5px solid ${
                focusedField === 'description' ? 'var(--border-focus)' : 'var(--border-subtle)'
              }`,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '14px',
              lineHeight: 1.5,
              outline: 'none',
              resize: 'vertical',
              minHeight: '84px',
              boxShadow: focusedField === 'description' ? 'var(--shadow-glow)' : 'none',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Drag and Drop Zone (Files & Folders webkitdirectory) */}
        <div className="animate-fade-up stagger-5">
          <Dropzone
            files={files}
            setFiles={setFiles}
            fileError={fileError}
            setFileError={setFileError}
          />
        </div>

        {/* Upload Progress Bar if submitting */}
        {isSubmitting && (
          <UploadProgress
            progress={uploadProgress}
            overallStatus={overallStatus}
            files={files}
            totalBytes={totalSize}
          />
        )}

        {/* Prominent Submission / Delivery Error Alert */}
        {submissionError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              fontSize: '13px',
              lineHeight: 1.5,
              animation: 'fadeUp 200ms ease',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600 }}>Delivery Failed</div>
              <div>{submissionError}</div>
            </div>
          </div>
        )}

        {/* Submit Button (Morphs to spinner, then checkmark) */}
        {!isSubmitting && (
          <div style={{ marginTop: '6px' }}>
            <SendButton
              isSubmitting={isSubmitting}
              isSuccess={isSuccess}
              disabled={files.length === 0 || recipientEmails.length === 0}
              onClick={handleSubmit}
              fileCount={files.length}
            />
          </div>
        )}
      </form>
    </div>
  );
}
