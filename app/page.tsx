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
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: '640px',
          width: '100%',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Shoprite-X Polling App
        </h1>
        <p
          style={{
            fontSize: 'var(--font-size-lg)',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--space-8)',
          }}
        >
          Live polling and facilitation tool for workshops and sessions.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
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
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '2px solid var(--color-primary-200)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
            }}
          >
            <span
              style={{ fontSize: '2.5rem', lineHeight: 1 }}
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
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '2px solid var(--color-success-200)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
            }}
          >
            <span
              style={{ fontSize: '2.5rem', lineHeight: 1 }}
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
              }}
            >
              Run live sessions, control poll flow, and view real-time results
            </span>
          </Link>

          {/* Participant */}
          <Link
            href="/admin"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-6)',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '2px solid var(--color-warning-200)',
              borderRadius: 'var(--radius-lg)',
              textDecoration: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
            }}
          >
            <span
              style={{ fontSize: '2.5rem', lineHeight: 1 }}
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
              }}
            >
              Join a poll session and submit your responses
            </span>
          </Link>
        </div>

        <p
          style={{
            marginTop: 'var(--space-6)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}
        >
          Facilitators and Participants: select a poll from the Admin dashboard to access your session.
        </p>
      </div>
    </main>
  );
}
