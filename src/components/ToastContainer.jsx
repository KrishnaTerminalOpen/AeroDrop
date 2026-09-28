import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '380px',
        width: 'calc(100% - 40px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let iconColor = 'var(--color-success)';
        let borderColor = 'var(--border-subtle)';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          iconColor = 'var(--color-error)';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          iconColor = 'var(--color-warning)';
        } else if (toast.type === 'info') {
          Icon = Info;
          iconColor = 'var(--accent-primary)';
        }

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            style={{
              pointerEvents: 'auto',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: `1px solid ${borderColor}`,
              borderRadius: '12px',
              boxShadow: 'var(--shadow-elevated)',
              animation: 'toastSlideIn 250ms var(--ease-spring) forwards',
              overflow: 'hidden',
            }}
          >
            <Icon size={20} color={iconColor} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title && (
                <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.3, marginBottom: '2px' }}>
                  {toast.title}
                </div>
              )}
              {toast.message && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-placeholder)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-placeholder)')}
            >
              <X size={15} />
            </button>

            {/* Shrinking progress underline */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: '3px',
                backgroundColor: iconColor,
                animation: `shrinkWidth ${toast.duration || 4000}ms linear forwards`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
