'use client';

import { useState, useEffect } from 'react';
import { useAdminToken } from '@/lib/hooks/useAdminToken';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, setToken, isAuthenticated, isLoaded } = useAdminToken();
  const [inputToken, setInputToken] = useState('');

  if (!isLoaded) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main
        id="main-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 'var(--space-8)',
        }}
      >
        <section
          style={{
            maxWidth: '400px',
            width: '100%',
            padding: 'var(--space-8)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--space-4)',
              color: 'var(--color-primary-800)',
            }}
          >
            SprintPulse
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-6)',
            }}
          >
            Enter the admin token to access the dashboard.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputToken.trim()) {
                setToken(inputToken.trim());
              }
            }}
          >
            <label
              htmlFor="admin-token-input"
              style={{
                display: 'block',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Admin Token
            </label>
            <input
              id="admin-token-input"
              type="password"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Enter admin token"
              required
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
                marginBottom: 'var(--space-4)',
              }}
            />
            <button
              type="submit"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-primary-700)',
                color: 'var(--color-text-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-page)' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-bg-primary)',
          boxShadow: 'var(--shadow-sm)',
        }}
        aria-label="Admin navigation"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 'var(--font-weight-bold)',
              color: 'var(--color-primary-800)',
              textDecoration: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: 'var(--radius-sm)' }} />
            SprintPulse
          </Link>
          <Link
            href="/admin"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Polls
          </Link>
        </div>
      </nav>
      <main id="main-content" style={{ flex: 1, padding: 'var(--space-8) var(--space-6)' }}>
        {children}
      </main>
    </div>
  );
}
