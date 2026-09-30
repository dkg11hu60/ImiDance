-- Migration 005: Add cancelled_at to attendances table
ALTER TABLE public.attendances
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.attendances.cancelled_at IS 'Timestamp when the attendance registration was cancelled';
