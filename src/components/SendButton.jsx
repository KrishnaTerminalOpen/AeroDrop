import React from 'react';
import { Send, Loader2, Check } from 'lucide-react';

export default function SendButton({
  isSubmitting,
  isSuccess,
  disabled,
  onClick,
  fileCount = 0,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSubmitting || isSuccess}
      className="touch-target btn-press"
      style={{
        width: '100%',
        height: '50px',
        borderRadius: '12px',
        backgroundColor: isSuccess
          ? 'var(--color-success)'
          : isSubmitting
          ? 'var(--accent-primary-hover)'
          : 'var(--accent-primary)',
        color: '#ffffff',
        border: 'none',
        fontSize: '15px',
        fontWeight: 600,
        letterSpacing: '-0.2px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: disabled
          ? 'none'
          : isSuccess
          ? '0 6px 20px rgba(16, 185, 129, 0.35)'
          : '0 6px 20px var(--accent-glow)',
        transition: 'all 250ms var(--ease-spring)',
      }}
    >
      {isSuccess ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'checkmarkPop 300ms var(--ease-spring)',
          }}
        >
          <Check size={20} strokeWidth={3} />
          <span>Sent Successfully!</span>
        </span>
      ) : isSubmitting ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Encrypting & Sending...</span>
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Send size={18} />
          <span>
            {fileCount > 0 ? `Send ${fileCount} ${fileCount === 1 ? 'File' : 'Files'} Now` : 'Send Transfer'}
          </span>
        </span>
      )}
    </button>
  );
}
