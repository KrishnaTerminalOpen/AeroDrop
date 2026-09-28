import React from 'react';
import { FileText, Folder, Image, Film, Music, Archive, Code, X } from 'lucide-react';
import { formatBytes, truncateFileName } from '../utils/formatters';

function getFileIcon(name = '', isFolder = false) {
  if (isFolder) return Folder;
  const ext = name.split('.').pop().toLowerCase();

  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'avif'].includes(ext)) return Image;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return Film;
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return Music;
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return Archive;
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'go', 'rs'].includes(ext)) return Code;
  return FileText;
}

export default function FileChip({ file, onRemove }) {
  const isFolderItem = Boolean(file.relativePath && file.relativePath.includes('/'));
  const Icon = getFileIcon(file.name, isFolderItem);

  return (
    <div
      title={file.relativePath || file.name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        backgroundColor: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        maxWidth: '100%',
        animation: 'fadeUp 200ms var(--ease-spring)',
        transition: 'border-color 150ms ease, background-color 150ms ease',
      }}
    >
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '6px',
          backgroundColor: 'var(--accent-subtle)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={14} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '200px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {truncateFileName(file.relativePath || file.name, 22)}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-placeholder)' }}>
          {formatBytes(file.size)}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove file ${file.name}`}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-placeholder)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 150ms ease, transform 150ms ease, background-color 150ms ease',
          marginLeft: '2px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-error)';
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.backgroundColor = 'var(--color-error-bg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-placeholder)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
