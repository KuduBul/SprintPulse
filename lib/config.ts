/**
 * Environment configuration with typed variables and defaults.
 * Required variables will throw at startup if missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  /** Supabase Postgres connection string (required) */
  DATABASE_URL: requireEnv('DATABASE_URL'),

  /** Shared secret for admin API authentication (required) */
  ADMIN_SECRET: requireEnv('ADMIN_SECRET'),

  /** Number of days to retain poll responses before purge (default: 90) */
  RETENTION_RESPONSES_DAYS: parseInt(
    optionalEnv('RETENTION_RESPONSES_DAYS', '90'),
    10
  ),

  /** Number of days to retain audit logs before purge (default: 365) */
  RETENTION_AUDIT_DAYS: parseInt(
    optionalEnv('RETENTION_AUDIT_DAYS', '365'),
    10
  ),

  /** Polling interval in milliseconds for live result updates (default: 3000) */
  POLL_INTERVAL_MS: parseInt(optionalEnv('POLL_INTERVAL_MS', '3000'), 10),
} as const;

export type Config = typeof config;
