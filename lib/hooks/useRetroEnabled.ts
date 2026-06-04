'use client';

import { RETRO_ENABLED } from '@/lib/featureFlags';

/**
 * Client hook for conditionally rendering retro UI.
 *
 * Returns whether the retro feature is enabled via `NEXT_PUBLIC_RETRO_ENABLED`.
 * Because the flag carries the `NEXT_PUBLIC_` prefix, its value is inlined into
 * the client bundle at build time, so this is a stable, render-safe boolean
 * (no hydration mismatch and no flicker).
 *
 * Use it to gate the Pulse/Retro selector, retro nav links, and `/retro/*`
 * entry points so they never render when the flag is off (Requirement 1.1).
 *
 * ```tsx
 * function ActivityTypeSelector() {
 *   const retroEnabled = useRetroEnabled();
 *   if (!retroEnabled) return <PulseOnlyCreate />;
 *   return <PulseOrRetroChoice />;
 * }
 * ```
 *
 * @returns `true` when retro is enabled, `false` otherwise (including unset).
 */
export function useRetroEnabled(): boolean {
  return RETRO_ENABLED;
}
