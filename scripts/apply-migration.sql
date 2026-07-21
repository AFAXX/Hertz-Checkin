-- ============================================================
-- Hertz-Checkin: One-shot migration fix for production Neon DB
-- ============================================================
-- Apply this script directly in the Neon SQL editor
-- (https://console.neon.tech → your project → SQL Editor)
-- if `prisma migrate deploy` is not running on Vercel build.
--
-- This script is IDEMPOTENT: safe to run multiple times.
-- It adds the `archivedAt` column to RentalContract (needed for
-- auto-archive at 04:00 AM) and ensures PhotoSubmission has the
-- timestamp / geolocation columns.
-- ============================================================

BEGIN;

-- 1) Add archivedAt column to RentalContract (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'RentalContract'
      AND column_name = 'archivedAt'
  ) THEN
    ALTER TABLE "RentalContract" ADD COLUMN "archivedAt" TIMESTAMP(3);
    RAISE NOTICE 'Added column RentalContract.archivedAt';
  ELSE
    RAISE NOTICE 'Column RentalContract.archivedAt already exists - skipped';
  END IF;
END $$;

-- 2) Add capturedAt / latitude / longitude to PhotoSubmission (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PhotoSubmission'
      AND column_name = 'capturedAt'
  ) THEN
    ALTER TABLE "PhotoSubmission"
      ADD COLUMN "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN "latitude" DOUBLE PRECISION,
      ADD COLUMN "longitude" DOUBLE PRECISION;
    RAISE NOTICE 'Added columns capturedAt/latitude/longitude to PhotoSubmission';
  ELSE
    RAISE NOTICE 'PhotoSubmission timestamp columns already exist - skipped';
  END IF;
END $$;

-- 3) Drop the unique constraint on [contractId, requirementId] (allows multiple photos per slot)
ALTER TABLE "PhotoSubmission" DROP CONSTRAINT IF EXISTS "PhotoSubmission_contractId_requirementId_key";

-- 4) Record this migration in the _prisma_migrations table so Prisma stops re-attempting it.
--    (Only if the _prisma_migrations table exists - it does once Prisma has been used once.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = '_prisma_migrations'
  ) THEN
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, finished_at, applied_steps_count)
    SELECT
      replace(gen_random_uuid()::text, '-', ''),
      'manual_apply_' || extract(epoch from now())::bigint::text,
      '20260721_add_geo_and_auth',
      '',
      now(),
      1
    WHERE NOT EXISTS (
      SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260721_add_geo_and_auth'
    );
    RAISE NOTICE 'Recorded migration 20260721_add_geo_and_auth in _prisma_migrations';
  ELSE
    RAISE NOTICE '_prisma_migrations table not found - Prisma will create it on next migrate';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- Verification queries (run separately to confirm)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'RentalContract' ORDER BY ordinal_position;
--
-- SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at;
-- ============================================================
