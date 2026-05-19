'use client';

interface TokenExpiryFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Duration options in milliseconds for computing ISO datetime relative to now. */
const EXPIRY_OPTIONS = [
  { label: 'No expiry', ms: null },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

/**
 * Dropdown for selecting an optional token expiry duration.
 * Converts the selected duration to an ISO datetime string relative to now.
 * "No expiry" maps to null.
 */
export function TokenExpiryField({ value, onChange }: TokenExpiryFieldProps) {
  /**
   * Determine which option is currently selected based on the value.
   * Since the value is an ISO datetime, we can't perfectly reverse-map it to a duration,
   * so we use the raw value to detect "no expiry" (null) vs "has expiry" (non-null).
   */
  const selectedIndex = value === null ? '0' : 'custom';

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = parseInt(e.target.value, 10);
    const option = EXPIRY_OPTIONS[idx];

    if (!option || option.ms === null) {
      onChange(null);
    } else {
      const expiresAt = new Date(Date.now() + option.ms).toISOString();
      onChange(expiresAt);
    }
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <label
        htmlFor="token-expiry"
        style={{
          display: 'block',
          fontWeight: 'var(--font-weight-medium)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Link Expiry
      </label>
      <select
        id="token-expiry"
        value={value === null ? '0' : selectedIndex === 'custom' ? '0' : selectedIndex}
        onChange={handleChange}
        aria-describedby="token-expiry-help"
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-base)',
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
        }}
      >
        {EXPIRY_OPTIONS.map((option, idx) => (
          <option key={idx} value={idx}>
            {option.label}
          </option>
        ))}
      </select>
      <p
        id="token-expiry-help"
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-xs)',
          marginTop: 'var(--space-1)',
          marginBottom: 0,
        }}
      >
        {value
          ? `Link expires: ${new Date(value).toLocaleString()}`
          : 'The poll link will remain valid indefinitely.'}
      </p>
    </div>
  );
}
