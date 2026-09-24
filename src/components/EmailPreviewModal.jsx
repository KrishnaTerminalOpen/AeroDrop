import React, { useState, useEffect } from 'react';
import { X, Mail, ExternalLink, RefreshCw, Send, CheckCircle2, Copy, Check } from 'lucide-react';

export default function EmailPreviewModal({
  isOpen,
  onClose,
  targetToken,
  showToast,
}) {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        const list = data.emails || [];
        setEmails(list);

        if (targetToken) {
          const matched = list.find((e) => e.token === targetToken);
          setSelectedEmail(matched || list[0] || null);
        } else if (list.length > 0) {
          setSelectedEmail(list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load email outbox:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen, targetToken]);

  if (!isOpen) return null;

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
          maxWidth: '920px',
          width: '100%',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Transactional Email Inspector
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-placeholder)', margin: 0 }}>
                Clean, branded HTML emails sent automatically upon file uploads
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchEmails}
              title="Refresh outbox"
              className="touch-target btn-press"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
              }}
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close"
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
        </div>

        {/* Body Layout: Sidebar + Preview */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Email Outbox List Sidebar */}
          <div
            style={{
              width: '280px',
              borderRight: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card-subtle)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-placeholder)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              Sent Outbox ({emails.length})
            </div>

            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: 'var(--text-placeholder)' }}>
                Loading outbox...
              </div>
            ) : emails.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-placeholder)' }}>
                No emails dispatched yet. Create a transfer to see it appear here!
              </div>
            ) : (
              emails.map((em) => {
                const isSelected = selectedEmail?.id === em.id;
                return (
                  <div
                    key={em.id}
                    onClick={() => setSelectedEmail(em)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--bg-card)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      transition: 'background-color 150ms ease',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {em.subject}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      To: {em.to}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-placeholder)' }}>
                      {new Date(em.sentAt).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Email Preview Frame */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f1f5f9',
            }}
          >
            {selectedEmail ? (
              <>
                {/* Email Metadata Ribbon */}
                <div
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    From: <strong>{selectedEmail.from}</strong> | To: <strong>{selectedEmail.to}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a
                      href={`/api/emails/${selectedEmail.id}/html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Open in New Tab</span>
                    </a>
                  </div>
                </div>

                {/* Rendered HTML Sandbox in iframe */}
                <div style={{ flex: 1, padding: '16px', overflow: 'hidden' }}>
                  <iframe
                    title="Transactional Email Preview"
                    srcDoc={selectedEmail.html}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-placeholder)', padding: '20px' }}>
                Select an email from the left sidebar to preview its branded layout.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
