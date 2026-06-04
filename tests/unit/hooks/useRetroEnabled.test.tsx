/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import React from 'react';

/**
 * Client-side flag gating for retro UI (Requirement 1.1, 1.4).
 *
 * `useRetroEnabled()` returns the build-time snapshot `RETRO_ENABLED`. The UI
 * uses it to decide whether to render retro entry points (the Pulse/Retro
 * selector, retro nav links, `/retro/*` pages). When the flag is off, no retro
 * entry point may render; when on, retro entry points render.
 *
 * Because `RETRO_ENABLED` is captured at module load, we mock the flag module
 * so each test can drive the hook deterministically regardless of the ambient
 * environment.
 *
 * Requirements: 1.1, 1.4
 */

// Mutable snapshot the mocked module reads from, controllable per test.
const flagState = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/lib/featureFlags', () => ({
  get RETRO_ENABLED() {
    return flagState.enabled;
  },
  isRetroEnabled: () => flagState.enabled,
}));

import { useRetroEnabled } from '@/lib/hooks/useRetroEnabled';

/**
 * Representative flag-gated entry point standing in for the real retro UI
 * (built later in task 7). It renders a retro entry point only when the hook
 * reports the feature enabled — exactly the gating contract every retro entry
 * point must follow.
 */
function RetroEntryPoint() {
  const retroEnabled = useRetroEnabled();
  if (!retroEnabled) {
    return <div>Pulse only</div>;
  }
  return <button>Start a Retro</button>;
}

describe('useRetroEnabled (client flag gating)', () => {
  beforeEach(() => {
    flagState.enabled = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when the flag is disabled', () => {
    flagState.enabled = false;
    const { result } = renderHook(() => useRetroEnabled());
    expect(result.current).toBe(false);
  });

  it('returns true when the flag is enabled', () => {
    flagState.enabled = true;
    const { result } = renderHook(() => useRetroEnabled());
    expect(result.current).toBe(true);
  });

  it('does NOT render any retro entry point when the flag is off', () => {
    // Requirement 1.1 — no retro entry point in the UI while disabled.
    flagState.enabled = false;

    render(<RetroEntryPoint />);

    expect(screen.queryByRole('button', { name: 'Start a Retro' })).toBeNull();
    expect(screen.getByText('Pulse only')).toBeInTheDocument();
  });

  it('renders the retro entry point when the flag is on', () => {
    // Requirement 1.4 — retro entry points become reachable when enabled.
    flagState.enabled = true;

    render(<RetroEntryPoint />);

    expect(screen.getByRole('button', { name: 'Start a Retro' })).toBeInTheDocument();
    expect(screen.queryByText('Pulse only')).toBeNull();
  });
});
