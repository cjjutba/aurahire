-- AuraHire - Row-Level Security policies
-- Generated to match docs/main/database-schema.md
-- Apply via Supabase MCP apply_migration; do not run manually in dashboard.

-- ============================================================================
-- ENABLE RLS ON ALL PUBLIC TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_excerpts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bias_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES
-- ============================================================================

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_recruiter_view_applicants" ON public.profiles
  FOR SELECT USING (
    role = 'candidate' AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.candidate_id = profiles.id
        AND j.recruiter_id = auth.uid()
    )
  );

-- ============================================================================
-- CANDIDATE_PROFILES
-- ============================================================================

CREATE POLICY "candidate_profiles_self" ON public.candidate_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "candidate_profiles_admin" ON public.candidate_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "candidate_profiles_recruiter_view" ON public.candidate_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.candidate_id = candidate_profiles.id
        AND j.recruiter_id = auth.uid()
    )
  );

-- ============================================================================
-- RECRUITER_PROFILES
-- ============================================================================

CREATE POLICY "recruiter_profiles_self" ON public.recruiter_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "recruiter_profiles_admin" ON public.recruiter_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- COMPANIES
-- ============================================================================

CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (true);

CREATE POLICY "companies_creator_update" ON public.companies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "companies_creator_insert" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- JOBS
-- ============================================================================

CREATE POLICY "jobs_public_read_published" ON public.jobs
  FOR SELECT USING (status = 'published');

CREATE POLICY "jobs_recruiter_all" ON public.jobs
  FOR ALL USING (auth.uid() = recruiter_id);

CREATE POLICY "jobs_admin_all" ON public.jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- RESUMES
-- ============================================================================

CREATE POLICY "resumes_candidate_all" ON public.resumes
  FOR ALL USING (auth.uid() = candidate_id);

CREATE POLICY "resumes_recruiter_view_in_application" ON public.resumes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.resume_id = resumes.id
        AND j.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "resumes_admin_all" ON public.resumes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- APPLICATIONS
-- ============================================================================

CREATE POLICY "applications_candidate_select" ON public.applications
  FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "applications_candidate_insert" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "applications_candidate_update_own" ON public.applications
  FOR UPDATE USING (auth.uid() = candidate_id) WITH CHECK (status = 'withdrawn');

CREATE POLICY "applications_recruiter_select" ON public.applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = applications.job_id AND jobs.recruiter_id = auth.uid())
  );

CREATE POLICY "applications_recruiter_update" ON public.applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = applications.job_id AND jobs.recruiter_id = auth.uid())
  );

CREATE POLICY "applications_admin_all" ON public.applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- INTERVIEWS
-- ============================================================================

CREATE POLICY "interviews_recruiter_all" ON public.interviews
  FOR ALL USING (auth.uid() = scheduled_by);

CREATE POLICY "interviews_candidate_select" ON public.interviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = interviews.application_id AND a.candidate_id = auth.uid()
    )
  );

CREATE POLICY "interviews_admin_all" ON public.interviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- OFFERS
-- ============================================================================

CREATE POLICY "offers_recruiter_all" ON public.offers
  FOR ALL USING (auth.uid() = sent_by);

CREATE POLICY "offers_candidate_select" ON public.offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = offers.application_id AND a.candidate_id = auth.uid()
    )
  );

CREATE POLICY "offers_candidate_respond" ON public.offers
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = offers.application_id AND a.candidate_id = auth.uid())
  ) WITH CHECK (status IN ('accepted', 'declined'));

CREATE POLICY "offers_admin_all" ON public.offers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- PROFILE_SCORES
-- ============================================================================

CREATE POLICY "profile_scores_candidate_select" ON public.profile_scores
  FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "profile_scores_recruiter_select" ON public.profile_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.candidate_id = profile_scores.candidate_id AND j.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "profile_scores_admin_all" ON public.profile_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- MATCH_SCORES
-- ============================================================================

CREATE POLICY "match_scores_candidate_select" ON public.match_scores
  FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "match_scores_recruiter_select" ON public.match_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = match_scores.job_id AND jobs.recruiter_id = auth.uid())
  );

CREATE POLICY "match_scores_admin_all" ON public.match_scores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- EVIDENCE_EXCERPTS
-- ============================================================================
-- Authorization mirrors parent score; service-layer enforces relationship
-- (polymorphic FK can't be expressed in DDL).

CREATE POLICY "evidence_excerpts_select_via_score" ON public.evidence_excerpts
  FOR SELECT USING (
    (score_type = 'profile' AND EXISTS (
      SELECT 1 FROM public.profile_scores ps WHERE ps.id = evidence_excerpts.score_id
    ))
    OR
    (score_type = 'match' AND EXISTS (
      SELECT 1 FROM public.match_scores ms WHERE ms.id = evidence_excerpts.score_id
    ))
  );

CREATE POLICY "evidence_excerpts_admin_all" ON public.evidence_excerpts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- BIAS_FLAGS
-- ============================================================================

CREATE POLICY "bias_flags_recruiter" ON public.bias_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = bias_flags.job_id AND jobs.recruiter_id = auth.uid())
  );

CREATE POLICY "bias_flags_admin_all" ON public.bias_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- SCORING_CONFIG
-- ============================================================================

CREATE POLICY "scoring_config_read" ON public.scoring_config
  FOR SELECT USING (is_active = true);

CREATE POLICY "scoring_config_admin_write" ON public.scoring_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================
-- Read-only via authenticated/anon roles. Inserts/updates only via service-role.

CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- No INSERT/UPDATE/DELETE policies on audit_logs:
-- - Service role bypasses RLS for inserts (via backend AuditService)
-- - Append-only: no app code should ever update or delete audit rows

-- ============================================================================
-- FEEDBACK
-- ============================================================================
-- Inserts open to authenticated users (own row only).
-- Selects + updates restricted to admins. Backend writes via service role
-- bypass RLS for both - policies are defense-in-depth.

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_self" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "feedback_admin_select" ON public.feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "feedback_admin_update" ON public.feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- interview_venues
-- ============================================================================
ALTER TABLE public.interview_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interview_venues_company_select" ON public.interview_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = interview_venues.company_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "interview_venues_recruiter_write" ON public.interview_venues
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.profiles p ON p.id = cm.user_id
      WHERE cm.company_id = interview_venues.company_id
        AND cm.user_id = auth.uid()
        AND p.role = 'recruiter'
    )
  );

CREATE POLICY "interview_venues_admin_all" ON public.interview_venues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
