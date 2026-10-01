import React, { useState, useEffect } from 'react';
import { X, Mail, ExternalLink, RefreshCw, Send, CheckCircle2, Copy, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function EmailPreviewModal({
  isOpen,
  onClose,
  targetToken,
  showToast,
}) {
  const { token } = useAuth();
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'preview'

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/emails', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.emails || [];
        setEmails(list);

        if (targetToken) {
          const matched = list.find((e) => e.token === targetToken);
          setSelectedEmail(matched || list[0] || null);
          if (matched || list[0]) setMobileView('preview');
        } else if (list.length > 0) {
          setSelectedEmail((prev) => prev || list[0]);
        }
      } else {
        setEmails([]);
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
  }, [isOpen, targetToken, token]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        animation: 'fadeUp 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        className="email-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '18px',
          maxWidth: '960px',
          width: '100%',
          height: '88vh',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {/* Back button for mobile preview */}
            {mobileView === 'preview' && (
              <button
                onClick={() => setMobileView('list')}
                className="touch-target btn-press email-mobile-back"
                style={{
                  display: 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                title="Back to outbox list"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Mail size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Transactional Email Outbox
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-placeholder)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Inspect rendered HTML emails dispatched for your transfers
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                fontWeight: 600,
              }}
            >
              <RefreshCw size={12} />
              <span className="email-btn-text">Refresh</span>
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
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Layout: Sidebar + Preview */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Email Outbox List Sidebar */}
          <div
            className={`email-sidebar ${mobileView === 'list' ? 'email-pane-active' : 'email-pane-hidden'}`}
            style={{
              width: '300px',
              borderRight: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card-subtle)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-placeholder)',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              Dispatched Emails ({emails.length})
            </div>

            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: 'var(--text-placeholder)' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid var(--border-subtle)',
                    borderTopColor: 'var(--accent-primary)',
                    borderRadius: '50%',
                    margin: '0 auto 10px auto',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Loading outbox...
              </div>
            ) : emails.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-placeholder)' }}>
                <Mail size={28} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <div>No emails found yet.</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>Create and send a transfer to see it appear here!</div>
              </div>
            ) : (
              emails.map((em) => {
                const isSelected = selectedEmail?.id === em.id;
                return (
                  <div
                    key={em.id}
                    onClick={() => {
                      setSelectedEmail(em);
                      setMobileView('preview');
                    }}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-placeholder)' }}>
                      <span>{new Date(em.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: em.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: em.status === 'delivered' ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}
                      >
                        {em.status === 'delivered' ? '✓ Sent' : 'Failed'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Email Preview Frame */}
          <div
            className={`email-preview-pane ${mobileView === 'preview' ? 'email-pane-active' : 'email-pane-hidden'}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f8fafc',
              minWidth: 0,
            }}
          >
            {selectedEmail ? (
              <>
                {/* Email Metadata Ribbon */}
                <div
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                    gap: '8px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span>To: <strong>{selectedEmail.to}</strong></span>
                    {selectedEmail.from && <span style={{ opacity: 0.7, marginLeft: '8px', fontSize: '11px' }}>via {selectedEmail.from}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--accent-subtle)',
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>Full Page</span>
                    </a>
                  </div>
                </div>

                {/* Rendered HTML Sandbox in iframe */}
                <div style={{ flex: 1, padding: '10px', overflow: 'hidden', minHeight: 0 }}>
                  <iframe
                    title="Transactional Email Preview"
                    srcDoc={selectedEmail.html}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-placeholder)', padding: '20px' }}>
                <Mail size={32} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                <div>Select an email to preview its rendered layout.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .email-sidebar {
            width: 100% !important;
            border-right: none !important;
          }
          .email-preview-pane {
            width: 100% !important;
          }
          .email-pane-hidden {
            display: none !important;
          }
          .email-pane-active {
            display: flex !important;
          }
          .email-mobile-back {
            display: inline-flex !important;
          }
          .email-btn-text {
            display: none;
          }
        }
        @media (min-width: 768px) {
          .email-sidebar {
            display: flex !important;
          }
          .email-preview-pane {
            display: flex !important;
          }
          .email-mobile-back {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
