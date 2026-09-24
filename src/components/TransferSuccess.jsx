import React, { useState, useEffect } from 'react';
import { CheckCircle2, Copy, Check, ExternalLink, Mail, RefreshCw, Clock, HardDrive, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes, formatDate } from '../utils/formatters';

export default function TransferSuccess({
  transfer,
  onReset,
  onViewEmail,
  onOpenLandingPage,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#3b82f6', '#10b981', '#6366f1'],
      });
    } catch (e) {}
  }, []);

  const handleCopy = () => {
    if (!transfer?.downloadUrl) return;
    navigator.clipboard.writeText(transfer.downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '18px',
        padding: '36px 28px',
        boxShadow: 'var(--shadow-card)',
        animation: 'fadeUp 300ms var(--ease-spring)',
        textAlign: 'center',
      }}
    >
      {/* Success Badge Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px auto',
          boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
          animation: 'checkmarkPop 400ms var(--ease-spring)',
        }}
      >
        <CheckCircle2 size={36} strokeWidth={2.5} />
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px', letterSpacing: '-0.4px' }}>
        Transfer Sent Instantly!
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
        Your files have been encrypted, compressed, and transactional emails have been sent to{' '}
        <strong style={{ color: 'var(--text-main)' }}>
          {transfer.recipientEmails.length === 1
            ? transfer.recipientEmails[0]
            : `${transfer.recipientEmails.length} recipients`}
        </strong>.
      </p>

      {/* Transfer Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
          backgroundColor: 'var(--bg-card-subtle)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '26px',
          textAlign: 'left',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-placeholder)', marginBottom: '4px' }}>
            <Users size={13} />
            <span>RECIPIENTS</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {transfer.recipientEmails.join(', ')}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-placeholder)', marginBottom: '4px' }}>
            <HardDrive size={13} />
            <span>TOTAL SIZE</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            {formatBytes(transfer.totalSize)} ({transfer.fileCount || transfer.files?.length} files)
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-placeholder)', marginBottom: '4px' }}>
            <Clock size={13} />
            <span>EXPIRES ON</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            {formatDate(transfer.expiresAt)}
          </div>
        </div>
      </div>

      {/* Shareable Download Link Box */}
      <div style={{ marginBottom: '26px', textAlign: 'left' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
          Secure Expiring Download Link:
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '4px 6px 4px 14px',
            gap: '8px',
          }}
        >
          <input
            type="text"
            readOnly
            value={transfer.downloadUrl}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              color: 'var(--text-main)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCopy}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: copied ? 'var(--color-success)' : 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 200ms ease',
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => onOpenLandingPage(transfer.token)}
          className="touch-target btn-press"
          style={{
            flex: '1 1 200px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--text-main)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <ExternalLink size={16} color="var(--accent-primary)" />
          <span>Open Recipient Page</span>
        </button>

        <button
          onClick={() => onViewEmail(transfer.token)}
          className="touch-target btn-press"
          style={{
            flex: '1 1 200px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card-subtle)',
            color: 'var(--text-main)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Mail size={16} color="var(--accent-primary)" />
          <span>View Sent Email</span>
        </button>
      </div>

      <button
        onClick={onReset}
        className="touch-target btn-press"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-placeholder)',
          fontSize: '13px',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '8px',
          transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-placeholder)')}
      >
        <RefreshCw size={14} />
        <span>Send Another Transfer</span>
      </button>
    </div>
  );
}
