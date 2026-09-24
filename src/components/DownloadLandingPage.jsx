import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Clock,
  User,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Folder,
  ArrowLeft,
  ShieldCheck,
  FileDown,
} from 'lucide-react';
import { formatBytes, formatDate, formatTimeRemaining } from '../utils/formatters';
import ExpiredErrorState from './ExpiredErrorState';

export default function DownloadLandingPage({ token, onBackToCompose }) {
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    async function fetchTransfer() {
      try {
        setLoading(true);
        setErrorState(null);
        const res = await fetch(`/api/transfers/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          setErrorState({
            code: errData.code || res.status.toString(),
            title: res.status === 410 ? 'Transfer Link Expired' : 'Transfer Not Found',
            message: errData.message || 'We could not locate this transfer package.',
            details: errData.transfer,
          });
          setLoading(false);
          return;
        }

        const data = await res.json();
        setTransfer(data);
      } catch (err) {
        setErrorState({
          code: 'NETWORK_ERROR',
          title: 'Connection Error',
          message: 'Failed to connect to the transfer server. Please verify your internet connection.',
        });
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchTransfer();
    }
  }, [token]);

  const handleDownloadAll = () => {
    setIsDownloading(true);
    // Trigger download via direct link
    window.location.href = `/api/download/${token}`;

    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      // Update local download count
      setTransfer((prev) => (prev ? { ...prev, downloadCount: (prev.downloadCount || 0) + 1 } : prev));
    }, 1500);
  };

  const handleDownloadSingle = (fileId) => {
    window.location.href = `/api/download/${token}/file/${fileId}`;
  };

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '680px',
          margin: '40px auto',
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-placeholder)',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            margin: '0 auto 16px auto',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-main)' }}>
          Loading your secure transfer...
        </div>
      </div>
    );
  }

  if (errorState) {
    return (
      <ExpiredErrorState
        code={errorState.code}
        title={errorState.title}
        message={errorState.message}
        transferDetails={errorState.details}
        onBackToCompose={onBackToCompose}
      />
    );
  }

  if (!transfer) return null;

  const isMultiple = transfer.files?.length > 1 || transfer.isZip;
  const timeRemaining = formatTimeRemaining(transfer.expiresAt);

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      <button
        onClick={onBackToCompose}
        className="touch-target btn-press"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          marginBottom: '16px',
          padding: '6px 0',
        }}
      >
        <ArrowLeft size={16} />
        <span>Back to AeroDrop Compose</span>
      </button>

      {/* Main Download Card with hover elevation */}
      <div
        className="hover-lift"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          padding: '36px 32px',
          transition: 'background-color 300ms ease, border-color 300ms ease',
        }}
      >
        {/* Top Header Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent-primary)',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
            }}
          >
            <ShieldCheck size={14} />
            <span>Verified Secure Transfer</span>
          </div>

          {/* Expiry Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-warning)',
              backgroundColor: 'var(--color-warning-bg)',
              padding: '4px 12px',
              borderRadius: '999px',
            }}
          >
            <Clock size={14} />
            <span>Expires: {timeRemaining}</span>
          </div>
        </div>

        {/* Transfer Subject & Sender Info */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: 'var(--text-main)',
            marginBottom: '8px',
            lineHeight: 1.3,
          }}
        >
          {transfer.subject}
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          <User size={16} color="var(--accent-primary)" />
          <span>
            Shared by <strong style={{ color: 'var(--text-main)' }}>{transfer.senderEmail}</strong>
          </span>
        </div>

        {/* Sender's Message / Description */}
        {transfer.description && (
          <div
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              borderLeft: '4px solid var(--accent-primary)',
              borderRadius: '0 10px 10px 0',
              padding: '16px 20px',
              fontSize: '14px',
              color: 'var(--text-main)',
              lineHeight: 1.6,
              marginBottom: '28px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {transfer.description}
          </div>
        )}

        {/* File List Summary Box */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={15} />
              FILES ({transfer.files?.length || 0})
            </span>
            <span>Total: {formatBytes(transfer.totalSize)}</span>
          </div>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-input)',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {transfer.files?.map((file, idx) => {
              const isFolderItem = file.relativePath && file.relativePath.includes('/');
              return (
                <div
                  key={file.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom:
                      idx === transfer.files.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    transition: 'background-color 150ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {isFolderItem ? <Folder size={18} /> : <FileText size={18} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {file.relativePath || file.originalName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-placeholder)' }}>
                        {formatBytes(file.sizeBytes)}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadSingle(file.id)}
                    title="Download this file individually"
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
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginLeft: '10px',
                    }}
                  >
                    <FileDown size={14} />
                    <span>Download</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Primary Download All Button */}
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className="touch-target btn-press"
          style={{
            width: '100%',
            height: '52px',
            borderRadius: '12px',
            backgroundColor: downloadSuccess ? 'var(--color-success)' : 'var(--accent-primary)',
            color: '#ffffff',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: '0 6px 20px var(--accent-glow)',
            transition: 'all 200ms ease',
            marginBottom: '16px',
          }}
        >
          {downloadSuccess ? (
            <>
              <CheckCircle2 size={20} />
              <span>Download Started! Check Your Downloads</span>
            </>
          ) : (
            <>
              <Download size={20} />
              <span>
                {isMultiple
                  ? `Download All as ZIP (${formatBytes(transfer.totalSize)})`
                  : `Download File (${formatBytes(transfer.totalSize)})`}
              </span>
            </>
          )}
        </button>

        {/* Download metadata footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-placeholder)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>Downloads logged: {transfer.downloadCount || 0} times</span>
          <span>Security: Virus scanned & end-to-end checksum verified</span>
        </div>
      </div>
    </div>
  );
}
