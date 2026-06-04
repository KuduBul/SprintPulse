/**
 * Feature flags for SprintPulse.
 *
 * Phase 2 (the Retro Board) is gated entirely behind a single flag:
 * `NEXT_PUBLIC_RETRO_ENABLED`. This is the first of two independent production
 * locks (the other being the long-lived `phase-2-retro` git branch). See
 * `.kiro/specs/retro-board-phase-2/decisions.md` (Decision 1).
 *
 * Semantics:
 * - The flag is ONLY considered enabled when the value is exactly the string
 *   `"true"`. Any other value — including unset/undefined — is treated as
 *   disabled. Production never defines this variable, so retro is always off
 *   there (Requirement 1.3).
 * - The `NEXT_PUBLIC_` prefix means Next.js inlines the value into the client
 *   bundle at build time, so the same flag drives both server guards and
 *   client rendering.
 *
 * This module is intentionally free of server-only imports (e.g. `next/server`)
 * so it can be imported safely from both client components and server code.
 */

/**
 * Evaluates the retro feature flag at call time.
 *
 * Reading `process.env` inside a function (rather than capturing it once) keeps
 * server-side guards correct and testable: tests can set/unset the variable and
 * observe the change without re-importing the module.
 */
export function isRetroEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RETRO_ENABLED === 'true';
}

/**
 * Static snapshot of the retro flag, evaluated at module load.
 *
 * Use this in client components / UI where the value is inlined at build time
 * (e.g. conditionally rendering the Pulse/Retro selector). For server-side
 * runtime guards, prefer {@link isRetroEnabled}.
 */
export const RETRO_ENABLED = isRetroEnabled();
