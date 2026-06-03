import fs from 'fs';
import path from 'path';
import { Metadata } from 'next';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/help/MarkdownRenderer';

export const metadata: Metadata = {
  title: 'Participant Guide — SprintPulse',
  description: 'Learn how to join a poll, submit responses, and participate in live sessions on SprintPulse.',
};

export default function ParticipantGuidePage() {
  const filePath = path.join(process.cwd(), 'docs', 'User-Guide-Participant.md');
  const content = fs.readFileSync(filePath, 'utf-8');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-page)' }}>
      {/* Navigation bar */}
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
        aria-label="Help navigation"
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Link
            href="/help/facilitator"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Facilitator Guide
          </Link>
          <Link
            href="/poll"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'var(--color-primary-700)',
              color: 'var(--color-text-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              textDecoration: 'none',
            }}
          >
            Join a Poll
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main id="main-content" style={{ padding: 'var(--space-8) var(--space-6)' }}>
        <MarkdownRenderer content={content} />
      </main>
    </div>
  );
}
