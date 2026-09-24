import React, { useState, useRef } from 'react';
import { UploadCloud, FolderUp, FilePlus, CheckCircle2, AlertCircle } from 'lucide-react';
import FileChip from './FileChip';
import { formatBytes } from '../utils/formatters';
import { MAX_FILE_SIZE } from '../utils/validators';

export default function Dropzone({
  files,
  setFiles,
  fileError,
  setFileError,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDropSuccessPulse, setShowDropSuccessPulse] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const processFileList = (newFiles) => {
    const fileArray = Array.from(newFiles).map((file) => {
      // webkitRelativePath is available when folders are chosen or dropped
      const relPath = file.webkitRelativePath || file.name;
      return Object.assign(file, { relativePath: relPath });
    });

    const combined = [...files, ...fileArray];
    const totalSize = combined.reduce((acc, f) => acc + f.size, 0);

    if (totalSize > MAX_FILE_SIZE) {
      setFileError(
        `Total upload size (${formatBytes(totalSize)}) exceeds the 2 GB limit.`
      );
      return;
    }

    setFileError(null);
    setFiles(combined);

    // Trigger brief drop success pulse animation as specified in PDF
    setShowDropSuccessPulse(true);
    setTimeout(() => setShowDropSuccessPulse(false), 600);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.items) {
      const items = e.dataTransfer.items;
      const fileList = [];

      // Check if browser supports modern webkitGetAsEntry for folders
      const traverseFileTree = async (item, path = '') => {
        if (item.isFile) {
          return new Promise((resolve) => {
            item.file((file) => {
              file.relativePath = path ? `${path}/${file.name}` : file.name;
              fileList.push(file);
              resolve();
            });
          });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          return new Promise((resolve) => {
            dirReader.readEntries(async (entries) => {
              for (const entry of entries) {
                await traverseFileTree(entry, path ? `${path}/${item.name}` : item.name);
              }
              resolve();
            });
          });
        }
      };

      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          promises.push(traverseFileTree(entry));
        } else if (items[i].kind === 'file') {
          const f = items[i].getAsFile();
          if (f) fileList.push(f);
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        if (fileList.length > 0) {
          processFileList(fileList);
          return;
        }
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
      e.target.value = '';
    }
  };

  const removeFile = (index) => {
    const updated = files.filter((_, idx) => idx !== index);
    setFiles(updated);
    if (fileError && updated.length === 0) {
      setFileError(null);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Hidden Inputs for Files and Folders */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory="true"
        directory="true"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Main Drag-and-Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${
            isDragOver
              ? 'var(--accent-primary)'
              : fileError
              ? 'var(--color-error)'
              : 'var(--border-subtle)'
          }`,
          backgroundColor: isDragOver
            ? 'var(--accent-subtle)'
            : 'var(--bg-input)',
          borderRadius: '14px',
          padding: files.length > 0 ? '18px' : '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          animation: showDropSuccessPulse ? 'dropPulse 400ms ease' : 'none',
          boxShadow: isDragOver ? 'var(--shadow-glow)' : 'none',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Upload Icon with micro-animation */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: isDragOver
              ? 'var(--accent-glow)'
              : 'var(--bg-card-subtle)',
            color: isDragOver ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            animation: isDragOver ? 'bounceSubtle 600ms infinite ease-in-out' : 'none',
            transition: 'background-color 200ms ease, color 200ms ease',
          }}
        >
          {showDropSuccessPulse ? (
            <CheckCircle2 size={26} color="var(--color-success)" />
          ) : (
            <UploadCloud size={26} />
          )}
        </div>

        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
          {isDragOver ? 'Drop files or folders right here' : 'Drag & drop files or folders here'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-placeholder)', marginBottom: '16px' }}>
          Up to 2GB per transfer • Fast, secure and encrypted
        </div>

        {/* Action Buttons: Choose Files & Choose Folder */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <FilePlus size={15} color="var(--accent-primary)" />
            <span>Select Files</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="touch-target btn-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <FolderUp size={15} color="var(--accent-primary)" />
            <span>Select Entire Folder</span>
          </button>
        </div>
      </div>

      {/* File Size Guard / Validation Error */}
      {fileError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-error)',
            fontSize: '12px',
            animation: 'fadeUp 150ms ease',
          }}
        >
          <AlertCircle size={14} />
          <span>{fileError}</span>
        </div>
      )}

      {/* Attached File Chips List */}
      {files.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '14px',
            animation: 'fadeUp 200ms var(--ease-spring)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              ATTACHED ITEMS ({files.length})
            </span>
            <span style={{ color: 'var(--accent-primary)' }}>
              Total: {formatBytes(totalSize)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '190px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {files.map((file, idx) => (
              <FileChip
                key={`${file.name}_${idx}_${file.size}`}
                file={file}
                onRemove={() => removeFile(idx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
