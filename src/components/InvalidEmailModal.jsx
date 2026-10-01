import React from 'react';
import { AlertTriangle, X, Check, Mail, Sparkles } from 'lucide-react';

export default function InvalidEmailModal({
  isOpen,
  onClose,
  email = '',
  reason = 'The email address you entered is invalid or uses a non-existent domain.',
  suggestion = null,
  onApplySuggestion,
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.2)',
          padding: '28px 24px',
          position: 'relative',
          textAlign: 'center',
          animation: 'fadeUp 250ms var(--ease-spring)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="touch-target btn-press"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            color: 'var(--text-placeholder)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>

        {/* Pulsing Warning Icon */}
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '20px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
          }}
        >
          <AlertTriangle size={30} strokeWidth={2.3} />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '8px',
            letterSpacing: '-0.3px',
          }}
        >
          Invalid Email ID
        </h3>

        {/* Invalid Email Chip */}
        {email && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '14px',
              maxWidth: '100%',
              wordBreak: 'break-all',
            }}
          >
            <Mail size={14} style={{ flexShrink: 0 }} />
            <span>{email}</span>
          </div>
        )}

        {/* Reason Message */}
        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: suggestion ? '16px' : '24px',
          }}
        >
          {reason || 'The email address you entered is invalid, fake, or uses an unreachable domain. Please enter a genuine, active email address.'}
        </p>

        {/* Did you mean suggestion box */}
        {suggestion && onApplySuggestion && (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '6px' }}>
              <Sparkles size={14} />
              <span>Did you mean this email?</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
              {suggestion}
            </div>
            <button
              type="button"
              onClick={() => {
                onApplySuggestion(suggestion);
                onClose();
              }}
              className="touch-target btn-press"
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '10px',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Check size={14} />
              <span>Use {suggestion}</span>
            </button>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="touch-target btn-press"
          style={{
            width: '100%',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: suggestion ? 'var(--bg-card-subtle)' : 'var(--accent-primary)',
            color: suggestion ? 'var(--text-main)' : '#ffffff',
            border: suggestion ? '1px solid var(--border-subtle)' : 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: suggestion ? 'none' : 'var(--shadow-sm)',
          }}
        >
          Enter Real Email Address
        </button>
      </div>
    </div>
  );
}
