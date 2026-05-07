-- 0009_interview_flow_v2.sql
-- Interview flow redesign: venue + recommendation + reschedule + venue templates.

-- INTERVIEW_STATUS enum extension
ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_status_check;

ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('scheduled','completed','cancelled','no-show','rescheduled'));

-- Recommendation enum constraint
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS recommendation text
    CHECK (recommendation IN ('proceed','hold','reject'));

-- Venue + guidance columns
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS venue_name             text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_line           text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS room_or_floor          text,
  ADD COLUMN IF NOT EXISTS map_url                text,
  ADD COLUMN IF NOT EXISTS reporting_instructions text,
  ADD COLUMN IF NOT EXISTS what_to_bring          text,
  ADD COLUMN IF NOT EXISTS interviewer_name       text,
  ADD COLUMN IF NOT EXISTS interviewer_title      text,
  ADD COLUMN IF NOT EXISTS candidate_summary      text,
  ADD COLUMN IF NOT EXISTS shared_with_candidate_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_from_id    uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_to_id      uuid REFERENCES public.interviews(id) ON DELETE SET NULL;

-- Default format for new rows is in-person; existing rows untouched.
ALTER TABLE public.interviews ALTER COLUMN format SET DEFAULT 'in-person';

-- Backfill: copy legacy location_or_link into address_line where empty.
UPDATE public.interviews
SET address_line = location_or_link
WHERE address_line = '' AND location_or_link IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS interviews_recommendation_idx
  ON public.interviews(application_id, recommendation);

CREATE INDEX IF NOT EXISTS interviews_shared_idx
  ON public.interviews(application_id)
  WHERE shared_with_candidate_at IS NOT NULL;

-- interview_venues
CREATE TABLE IF NOT EXISTS public.interview_venues (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by             uuid NOT NULL REFERENCES public.profiles(id),
  label                  text NOT NULL,
  venue_name             text NOT NULL,
  address_line           text NOT NULL,
  room_or_floor          text,
  map_url                text,
  reporting_instructions text,
  what_to_bring          text,
  interviewer_name       text,
  interviewer_title      text,
  is_default             boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, label)
);

CREATE INDEX IF NOT EXISTS interview_venues_company_default_idx
  ON public.interview_venues(company_id) WHERE is_default = true;
