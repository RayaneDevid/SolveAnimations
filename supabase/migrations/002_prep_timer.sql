-- Add 'preparing' status to animation_status enum
ALTER TYPE animation_status ADD VALUE 'preparing' AFTER 'open';

-- Add prep timer columns to animations
ALTER TABLE animations
  ADD COLUMN prep_started_at   timestamptz null,
  ADD COLUMN prep_ended_at     timestamptz null,
  ADD COLUMN actual_prep_time_min int       null;
