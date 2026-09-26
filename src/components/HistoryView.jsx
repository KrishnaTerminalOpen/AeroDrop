import React, { useState, useEffect } from 'react';
import {
  History,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Download,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
} from 'lucide-react';
import { formatBytes, formatDate, formatTimeRemaining } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';

export default function HistoryView({
  onOpenLandingPage,
  onViewEmail,
  onNewTransfer,
  showToast,
}) {
  const { token, currentUser } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      } else {
        setTransfers([]);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  const handleCopyLink = (token, id) => {
    const origin = window.location.origin;
    const url = `${origin}/#download/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast({ type: 'success', title: 'Link Copied', message: 'Download link copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTransfers = transfers.filter((t) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.recipientEmails?.some((e) => e.toLowerCase().includes(q)) ||
      t.senderEmail?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: '840px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-main)' }}>
            Transfer Status & History
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-placeholder)', marginTop: '2px' }}>
            Monitor delivery status, download activities, and expiring links.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 12px',
              gap: '6px',
            }}
          >
            <Search size={14} color="var(--text-placeholder)" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search transfers..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-main)',
                fontSize: '13px',
                width: '140px',
              }}
            />
          </div>

          <button
            onClick={onNewTransfer}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Send size={14} />
            <span>New Transfer</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-placeholder)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              margin: '0 auto 12px auto',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontSize: '14px' }}>Loading transfer history...</span>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '50px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-placeholder)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
            }}
          >
            <History size={26} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
            No transfers found
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-placeholder)', marginBottom: '20px' }}>
            {filterQuery
              ? 'No transfers match your search query.'
              : 'You have not sent any files yet. Send your first transfer now!'}
          </p>
          <button
            onClick={onNewTransfer}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Send size={16} />
            <span>Compose Transfer</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredTransfers.map((item) => {
            const isExpired = item.status === 'expired' || new Date(item.expiresAt) < new Date();
            const isDownloaded = item.status === 'downloaded' || item.downloadCount > 0;

            let statusBadge = (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={12} />
                <span>Sent</span>
              </span>
            );

            if (isExpired) {
              statusBadge = (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertCircle size={12} />
                  <span>Expired</span>
                </span>
              );
            } else if (isDownloaded) {
              statusBadge = (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--color-success-bg)',
                    color: 'var(--color-success)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Download size={12} />
                  <span>Downloaded ({item.downloadCount}x)</span>
                </span>
              );
            }

            return (
              <div
                key={item.id}
                className="hover-lift"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '18px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 200ms ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.subject}
                      </span>
                      {statusBadge}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      To: <strong style={{ color: 'var(--text-main)' }}>{item.recipientEmails.join(', ')}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatBytes(item.totalSize)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                      {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                    </div>
                  </div>
                </div>

                {item.description && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    "{item.description}"
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '12px',
                    fontSize: '12px',
                    color: 'var(--text-placeholder)',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span>Sent: {formatDate(item.createdAt)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} />
                      {isExpired ? 'Expired' : `Expires in ${formatTimeRemaining(item.expiresAt)}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleCopyLink(item.token, item.id)}
                      title="Copy download link"
                      className="touch-target btn-press"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedId === item.id ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
                      <span>{copiedId === item.id ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <button
                      onClick={() => onOpenLandingPage(item.token)}
                      title="Open recipient download page"
                      className="touch-target btn-press"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Download Page</span>
                    </button>

                    <button
                      onClick={() => onViewEmail(item.token)}
                      title="View sent transactional email"
                      className="touch-target btn-press"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      <Mail size={13} />
                      <span>View Email</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
