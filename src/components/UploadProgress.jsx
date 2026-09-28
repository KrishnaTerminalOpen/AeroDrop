import React from 'react';
import { CheckCircle2, Loader2, FileCheck } from 'lucide-react';
import { formatBytes } from '../utils/formatters';

export default function UploadProgress({
  progress = 0,
  overallStatus = 'uploading', // 'uploading' | 'zipping' | 'emailing' | 'completed'
  files = [],
  totalBytes = 0,
}) {
  const isComplete = overallStatus === 'completed' || progress >= 100;
  const transferredBytes = Math.round((progress / 100) * totalBytes);

  let statusLabel = 'Uploading files...';
  if (overallStatus === 'zipping') {
    statusLabel = 'Zipping files server-side...';
  } else if (overallStatus === 'emailing') {
    statusLabel = 'Dispatching instant transactional emails...';
  } else if (isComplete) {
    statusLabel = 'Upload complete & emails sent!';
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        padding: '20px',
        boxShadow: 'var(--shadow-elevated)',
        animation: 'fadeUp 300ms var(--ease-spring)',
      }}
    >
      {/* Header with status text & checkmark morph */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isComplete ? (
            <div
              style={{
                color: 'var(--color-success)',
                animation: 'checkmarkPop 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          ) : (
            <div style={{ color: 'var(--accent-primary)', animation: 'spin 1.2s linear infinite' }}>
              <Loader2 size={18} />
            </div>
          )}
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            {statusLabel}
          </span>
        </div>

        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: isComplete ? 'var(--color-success)' : 'var(--accent-primary)',
          }}
        >
          {Math.min(100, Math.round(progress))}%
        </span>
      </div>

      {/* Main Overall Progress Bar with Shimmer / Gradient Sweep */}
      <div
        style={{
          width: '100%',
          height: '10px',
          backgroundColor: 'var(--bg-card-subtle)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, progress)}%`,
            height: '100%',
            background: isComplete
              ? 'var(--color-success)'
              : 'linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #6366f1 100%)',
            borderRadius: '999px',
            position: 'relative',
            overflow: 'hidden',
            transition: 'width 200ms ease, background-color 300ms ease',
          }}
        >
          {/* Shimmer sweep animation while uploading */}
          {!isComplete && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage:
                  'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
                animation: 'shimmerSweep 1.5s infinite ease-in-out',
              }}
            />
          )}
        </div>
      </div>

      {/* Upload Details / Metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-placeholder)',
          marginBottom: files.length > 1 ? '16px' : '4px',
        }}
      >
        <span>
          {formatBytes(transferredBytes)} of {formatBytes(totalBytes)} transferred
        </span>
        <span>
          {files.length} {files.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Per-File Progress Snapshot (for multi-file transfers) */}
      {files.length > 1 && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '130px',
            overflowY: 'auto',
          }}
        >
          {files.slice(0, 5).map((file, idx) => {
            // Simulated per-file progress tracking
            const fileProgress = Math.min(
              100,
              Math.max(0, (progress - (idx / files.length) * 80) * (files.length / 0.8))
            );
            const isFileDone = progress >= 100 || fileProgress >= 100;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    maxWidth: '70%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {isFileDone ? (
                    <FileCheck size={13} color="var(--color-success)" />
                  ) : (
                    <Loader2 size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                  )}
                  <span>{file.relativePath || file.name}</span>
                </div>
                <span style={{ color: isFileDone ? 'var(--color-success)' : 'var(--text-placeholder)' }}>
                  {isFileDone ? 'Ready' : `${Math.round(fileProgress)}%`}
                </span>
              </div>
            );
          })}
          {files.length > 5 && (
            <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', textAlign: 'center' }}>
              + {files.length - 5} more files uploading concurrently
            </div>
          )}
        </div>
      )}
    </div>
  );
}
