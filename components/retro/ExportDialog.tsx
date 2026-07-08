'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ExportDialogProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * ExportDialog — Modal overlay with format options for exporting retro boards.
 *
 * Two export formats:
 * - PDF (primary, recommended) — triggers download via /api/retro/{boardId}/export/pdf
 * - JSON (secondary) — triggers download via /api/retro/{boardId}/export/pdf?format=json
 *
 * Shows a loading spinner during PDF generation.
 * Dismissible via close button or Escape key.
 */
export function ExportDialog({ boardId, isOpen, onClose }: ExportDialogProps) {
  const [exporting, setExporting] = useState<'pdf' | 'json' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus the close button when dialog opens
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleExport = useCallback(async (format: 'pdf' | 'json') => {
    setExporting(format);
    setError(null);

    try {
      const url = format === 'pdf'
        ? `/api/retro/${boardId}/export/pdf`
        : `/api/retro/${boardId}/export/pdf?format=json`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = format === 'pdf'
        ? `retro-export-${boardId}.pdf`
        : `retro-export-${boardId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Close dialog on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  }, [boardId, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 150ms ease',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-8)',
          maxWidth: '440px',
          width: '90%',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close export dialog"
          style={{
            position: 'absolute',
            top: 'var(--space-4)',
            right: 'var(--space-4)',
            width: '36px',
            height: '36px',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            transition: 'background-color var(--transition-fast)',
          }}
        >
          ✕
        </button>

        {/* Title */}
        <h2
          id="export-dialog-title"
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            marginBottom: 'var(--space-2)',
            color: 'var(--color-text-primary)',
          }}
        >
          Export Board
        </h2>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-6)',
          }}
        >
          Choose a format to download your retro board data.
        </p>

        {/* Format options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* PDF option */}
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: exporting === 'pdf' ? 'var(--color-primary-50)' : 'var(--color-bg-secondary)',
              border: '2px solid var(--color-primary-500)',
              borderRadius: 'var(--radius-lg)',
              cursor: exporting !== null ? 'not-allowed' : 'pointer',
              opacity: exporting !== null && exporting !== 'pdf' ? 0.5 : 1,
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
              width: '100%',
              minHeight: '44px',
            }}
            aria-label="Export as PDF"
          >
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>
              {exporting === 'pdf' ? '⏳' : '📄'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                PDF Export
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}>
                Recommended — formatted report with all cards and votes
              </div>
            </div>
            {exporting === 'pdf' && (
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--color-primary-300)',
                  borderTopColor: 'var(--color-primary-700)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
                aria-label="Generating PDF..."
              />
            )}
          </button>

          {/* JSON option */}
          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-4) var(--space-5)',
              backgroundColor: exporting === 'json' ? 'var(--color-neutral-100)' : 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)',
              cursor: exporting !== null ? 'not-allowed' : 'pointer',
              opacity: exporting !== null && exporting !== 'json' ? 0.5 : 1,
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
              width: '100%',
              minHeight: '44px',
            }}
            aria-label="Export as JSON"
          >
            <span style={{ fontSize: 'var(--font-size-2xl)' }}>
              {exporting === 'json' ? '⏳' : '📋'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                JSON Export
              </div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
              }}>
                Raw data — useful for integrations and backups
              </div>
            </div>
            {exporting === 'json' && (
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--color-neutral-300)',
                  borderTopColor: 'var(--color-neutral-700)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
                aria-label="Generating JSON..."
              />
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-error-50)',
              border: '1px solid var(--color-error-200)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-error-700)',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
