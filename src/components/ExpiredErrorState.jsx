import React from 'react';
import { Clock, AlertTriangle, ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { formatDate } from '../utils/formatters';

export default function ExpiredErrorState({
  code = 'EXPIRED',
  title = 'Transfer Link Expired',
  message,
  transferDetails,
  onBackToCompose,
}) {
  const isExpired = code === 'EXPIRED';

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: '560px',
        width: '100%',
        margin: '40px auto',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        padding: '40px 32px',
        textAlign: 'center',
      }}
    >
      {/* Visual Error Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: isExpired ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
          color: isExpired ? 'var(--color-warning)' : 'var(--color-error)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
        }}
      >
        {isExpired ? <Clock size={32} /> : <AlertTriangle size={32} />}
      </div>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '10px',
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </h1>

      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '420px',
          margin: '0 auto 24px auto',
        }}
      >
        {message ||
          (isExpired
            ? 'This transfer link has reached its expiration date and the files have been automatically removed from storage for privacy.'
            : 'The transfer you are looking for does not exist or the URL is incorrect.')}
      </p>

      {/* Transfer Context if available */}
      {transferDetails && (
        <div
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '26px',
            fontSize: '13px',
            textAlign: 'left',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {transferDetails.subject && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-placeholder)' }}>Subject: </span>
              <strong style={{ color: 'var(--text-main)' }}>{transferDetails.subject}</strong>
            </div>
          )}
          {transferDetails.senderEmail && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-placeholder)' }}>Sender: </span>
              <span style={{ color: 'var(--text-main)' }}>{transferDetails.senderEmail}</span>
            </div>
          )}
          {transferDetails.expiredAt && (
            <div>
              <span style={{ color: 'var(--text-placeholder)' }}>Expired on: </span>
              <span style={{ color: 'var(--color-error)' }}>{formatDate(transferDetails.expiredAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          onClick={onBackToCompose}
          className="touch-target btn-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '10px',
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ArrowLeft size={16} />
          <span>Go to AeroDrop Compose</span>
        </button>
      </div>
    </div>
  );
}
