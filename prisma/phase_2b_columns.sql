-- Phase 2B additive columns for the retro board enhancements.
-- Idempotent and safe to run against any environment (dev, staging, prod).
-- All columns are nullable — no backfill required, backward compatible with Phase 2A.

ALTER TABLE "RetroBoard" ADD COLUMN IF NOT EXISTS "backgroundImage" JSONB;
ALTER TABLE "RetroLane"  ADD COLUMN IF NOT EXISTS "icon"  VARCHAR(10);
ALTER TABLE "RetroLane"  ADD COLUMN IF NOT EXISTS "color" VARCHAR(30);
