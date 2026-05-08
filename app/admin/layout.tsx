'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoaded, user, signOut } = useAuth();

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
        <AuthForm />
      </main>
    );
  }

  const displayName = user?.user_metadata?.display_name || user?.email || 'Facilitator';

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
          <Link
            href="/admin/profile"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Profile
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {displayName}
          </span>
          <button
            onClick={() => signOut()}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </nav>
      <main id="main-content" style={{ flex: 1, padding: 'var(--space-8) var(--space-6)' }}>
        {children}
      </main>
    </div>
  );
}
