import React from 'react';
import { X, Moon, Sun, Monitor, Clock, Bell, User, HardDrive, Check } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  defaultExpiry,
  setDefaultExpiry,
  defaultDownloadLimit,
  setDefaultDownloadLimit,
  senderEmail,
  setSenderEmail,
  notifyOnDownload,
  setNotifyOnDownload,
  showToast,
}) {
  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem('aerodrop_default_sender', senderEmail || '');
      localStorage.setItem('aerodrop_default_expiry', defaultExpiry.toString());
      localStorage.setItem('aerodrop_notify_download', notifyOnDownload ? 'true' : 'false');
    } catch (e) {}

    showToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'Your preferences have been updated.',
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeUp 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '20px',
          maxWidth: '520px',
          width: '100%',
          boxShadow: 'var(--shadow-card)',
          padding: '28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
              Platform Settings
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginTop: '2px' }}>
              Customize expiry defaults, themes, and delivery preferences.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close settings"
            className="touch-target btn-press"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-placeholder)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Theme Preference */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              Appearance Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Monitor },
              ].map((item) => {
                const Icon = item.icon;
                const active = theme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id)}
                    className="touch-target btn-press"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-card-subtle)',
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Expiration Period */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              Default Link Expiration
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { days: 1, label: '24 Hours' },
                { days: 3, label: '3 Days' },
                { days: 7, label: '7 Days' },
                { days: 30, label: '30 Days' },
              ].map((item) => {
                const active = defaultExpiry === item.days;
                return (
                  <button
                    key={item.days}
                    onClick={() => setDefaultExpiry(item.days)}
                    className="touch-target btn-press"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-card-subtle)',
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Download Limits */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              Download Limit (Optional)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { val: null, label: 'Unlimited' },
                { val: 1, label: '1 Time' },
                { val: 5, label: '5 Times' },
                { val: 10, label: '10 Times' },
              ].map((item, idx) => {
                const active = defaultDownloadLimit === item.val;
                return (
                  <button
                    key={idx}
                    onClick={() => setDefaultDownloadLimit(item.val)}
                    className="touch-target btn-press"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: active ? 'var(--accent-subtle)' : 'var(--bg-card-subtle)',
                      color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-fill Sender Email */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              Saved Sender Email (Auto-filled)
            </label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="e.g. you@company.com"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          {/* Notification Preferences */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle)',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bell size={18} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Download Activity Alerts
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                  Log & notify when recipients download your files
                </div>
              </div>
            </div>

            <input
              type="checkbox"
              checked={notifyOnDownload}
              onChange={(e) => setNotifyOnDownload(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Save button */}
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={handleSave}
            className="touch-target btn-press"
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Check size={16} />
            <span>Apply Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
}
