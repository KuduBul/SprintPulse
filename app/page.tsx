import Link from 'next/link';

export default function Home() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-family-sans)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '720px',
          width: '100%',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="SprintPulse — Agile Polls & Retrospectives"
            width={300}
            height={80}
            style={{ height: 'auto', maxWidth: '100%' }}
          />
        </div>

        <p
          style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-10)',
            lineHeight: 'var(--line-height-relaxed)',
          }}
        >
          Modern facilitation tool for live polling, retrospectives, and team engagement sessions.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-5)',
            width: '100%',
          }}
        >
          {/* Administrator */}
          <Link
            href="/admin"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-8) var(--space-6)',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              transition: 'all var(--transition-normal)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-primary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
              aria-hidden="true"
            >
              🛠️
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              Administrator
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                lineHeight: 'var(--line-height-relaxed)',
              }}
            >
              Create and manage polls, questions, and canvas layouts
            </span>
          </Link>

          {/* Facilitator */}
          <Link
            href="/admin"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-8) var(--space-6)',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              transition: 'all var(--transition-normal)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-secondary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
              aria-hidden="true"
            >
              📋
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              Facilitator
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                lineHeight: 'var(--line-height-relaxed)',
              }}
            >
              Run live sessions, control poll flow, and view real-time results
            </span>
          </Link>

          {/* Participant */}
          <Link
            href="/poll"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-8) var(--space-6)',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)',
              textDecoration: 'none',
              transition: 'all var(--transition-normal)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-warning-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}
              aria-hidden="true"
            >
              ✋
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              Participant
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                textAlign: 'center',
                lineHeight: 'var(--line-height-relaxed)',
              }}
            >
              Join a poll session and submit your responses
            </span>
          </Link>
        </div>

        <p
          style={{
            marginTop: 'var(--space-8)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
          }}
        >
          Facilitators and Participants: select a poll from the Admin dashboard to access your session.
        </p>
      </div>
    </main>
  );
}
