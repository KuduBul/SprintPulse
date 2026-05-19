'use client';

import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  url: string;
}

/**
 * Generates and displays a QR code client-side for the given poll URL.
 * Includes a download button to save the QR code as a PNG file.
 * Minimum size: 300x300 pixels.
 */
export function QRCodeDisplay({ url }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        const result = await QRCode.toDataURL(url, {
          width: 300,
          margin: 2,
          type: 'image/png',
        });
        if (!cancelled) {
          setDataUrl(result);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to generate QR code.');
        }
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [url]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'poll-qr-code.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dataUrl]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 'var(--space-3)',
          color: 'var(--color-error-700)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {error}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{
          width: '300px',
          height: '300px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Generating QR code...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <img
        src={dataUrl}
        alt={`QR code for poll URL: ${url}`}
        width={300}
        height={300}
        style={{
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
        }}
      />
      <button
        onClick={handleDownload}
        aria-label="Download QR code as PNG"
        style={{
          padding: 'var(--space-2) var(--space-4)',
          backgroundColor: 'var(--color-secondary-700)',
          color: 'var(--color-text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-semibold)',
          cursor: 'pointer',
        }}
      >
        Download QR
      </button>
    </div>
  );
}
