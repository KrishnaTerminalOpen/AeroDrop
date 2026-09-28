import React, { useState, useRef } from 'react';
import { X, Mail, AlertCircle, Plus } from 'lucide-react';
import { isValidEmail } from '../utils/validators';

export default function RecipientChipInput({
  emails,
  setEmails,
  error,
  setError,
}) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const addEmail = (raw) => {
    const trimmed = raw.trim().replace(/,$/, '');
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      setError(`"${trimmed}" is not a valid email address.`);
      return;
    }

    if (emails.includes(trimmed)) {
      setError(`"${trimmed}" is already added.`);
      return;
    }

    setEmails([...emails, trimmed]);
    setInputValue('');
    setError(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
      // Remove last chip on backspace
      removeEmail(emails.length - 1);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  };

  const removeEmail = (indexToRemove) => {
    setEmails(emails.filter((_, idx) => idx !== indexToRemove));
    if (error) setError(null);
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: isFocused ? 'var(--accent-primary)' : 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'color 200ms ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mail size={14} />
          Send to (Recipients) <span style={{ color: 'var(--color-error)' }}>*</span>
        </span>
        <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-placeholder)' }}>
          Press Enter or comma to add
        </span>
      </label>

      {/* Input / Chip Container with animated focus border and glow */}
      <div
        onClick={handleContainerClick}
        style={{
          minHeight: '48px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-input)',
          border: `1.5px solid ${
            error
              ? 'var(--color-error)'
              : isFocused
              ? 'var(--border-focus)'
              : 'var(--border-subtle)'
          }`,
          borderRadius: '10px',
          boxShadow: isFocused
            ? error
              ? '0 0 0 3px rgba(239, 68, 68, 0.2)'
              : 'var(--shadow-glow)'
            : 'none',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          cursor: 'text',
        }}
      >
        {emails.map((email, index) => (
          <span
            key={index}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent-primary)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: '999px',
              maxWidth: '100%',
              wordBreak: 'break-all',
              animation: 'fadeUp 200ms var(--ease-spring)',
            }}
          >
            <span>{email}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeEmail(index);
              }}
              aria-label={`Remove recipient ${email}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '50%',
                transition: 'transform 150ms ease, background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.backgroundColor = 'var(--accent-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={13} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={emails.length === 0 ? 'recipient@example.com (or multiple comma separated)' : 'Add another recipient...'}
          style={{
            flex: '1 1 180px',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-main)',
            fontSize: '14px',
            padding: '4px 0',
            minWidth: '160px',
          }}
        />
      </div>

      {/* Inline validation error */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: 'var(--color-error)',
            fontSize: '12px',
            marginTop: '2px',
            animation: 'fadeUp 150ms ease',
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
