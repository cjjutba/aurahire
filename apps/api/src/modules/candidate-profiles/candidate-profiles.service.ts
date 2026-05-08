import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { AuthUser, ParsedResume } from "@aurahire/shared";
import {
  personalCompleteSchema,
  preferencesCompleteSchema,
  reviewCompleteSchema,
} from "@aurahire/shared";
import { profileScoresTable, type Profile, type CandidateProfile } from "@aurahire/db";

import { AuditService } from "../../audit";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../../db/db.module";
import { MatchPreviewQueueService } from "../../queue/match-preview-queue.service";
import {
  ProfileScoreQueueService,
  type ProfileScoreRecomputeReason,
} from "../../queue/profile-score-queue.service";
import { ProfilesRepository } from "../profiles/profiles.repository";
import { ResumesRepository } from "../resumes/resumes.repository";
import { ScoringRepository } from "../scoring/scoring.repository";
import { ScoringService } from "../scoring/scoring.service";
import type { ProfileScoreDto } from "../scoring/dto/profile-score-response.dto";

import type { UpdateCandidatePersonalDto } from "./dto/personal.dto";
import type { UpdateCandidatePreferencesDto } from "./dto/preferences.dto";
import type { CandidateProfileMeDto } from "./dto/candidate-profile-response.dto";
import type {
  CompleteOnboardingDto,
  ProfileScoreError,
} from "./dto/complete-onboarding-response.dto";

@Injectable()
export class CandidateProfilesService {
  private readonly logger = new Logger(CandidateProfilesService.name);

  constructor(
    private readonly repo: ProfilesRepository,
    private readonly audit: AuditService,
    private readonly resumesRepo: ResumesRepository,
    private readonly profileScoreQueue: ProfileScoreQueueService,
    private readonly matchPreviewQueue: MatchPreviewQueueService,
    private readonly scoring: ScoringService,
    private readonly scoringRepo: ScoringRepository,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  async getMe(user: AuthUser): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.findCandidateProfile(user.id),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }
    if (!candidateProfile) {
      throw new NotFoundException({
        code: "CANDIDATE_PROFILE_NOT_FOUND",
        message: "Candidate profile missing — re-register",
      });
    }

    return this.toResponse(profile, candidateProfile);
  }

  /**
   * Idempotent backfill guard fired on candidate-portal entry (GET
   * /candidate-profiles/me). Candidates who completed onboarding before
   * the proactive-system rollout have `profile_completed = true` but no
   * `profile_scores` row. When such a candidate hits the portal we
   * enqueue a single backfill job — transparent self-healing, the
   * candidate sees nothing different except their score eventually
   * appears.
   *
   * Idempotency comes from the BullMQ jobId override:
   * `profile-score:<candidate>:<resume>`. If a backfill is already
   * queued or running, the second `add` is a no-op. Repeat dashboard
   * hits within the same session won't pile up duplicate work.
   *
   * Short-circuits when:
   *   1. The candidate already has a non-stale `profile_scores` row.
   *   2. The candidate has no default resume (nothing to score against;
   *      enqueueing would produce a worker no-op).
   */
  async enqueueProfileScoreIfMissing(candidateId: string): Promise<void> {
    const hasCurrent = await this.scoringRepo.hasCurrentProfileScore(candidateId);
    if (hasCurrent) return;

    const defaultResume = await this.resumesRepo.findDefaultByCandidateId(candidateId);
    if (!defaultResume) return;

    await this.profileScoreQueue.enqueueRecompute(
      {
        candidateId,
        resumeId: defaultResume.id,
        reason: "manual_recompute",
      },
      {
        // Backfill dedupe is keyed on candidate+resume only — we don't
        // want a "manual_recompute" reason colliding with a parallel
        // "profile_change" job, but we DO want repeat portal hits to
        // collapse into a single backfill.
        jobId: `profile-score-backfill:${candidateId}:${defaultResume.id}`,
      },
    );
  }

  async updatePersonal(
    user: AuthUser,
    dto: UpdateCandidatePersonalDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const { profile, candidateProfile } = await this.repo.updateProfileAndCandidateProfileTx(
      user.id,
      { fullName: dto.fullName, phone: dto.phone },
      {
        headline: dto.headline ?? null,
        summary: dto.summary ?? null,
        locationCity: dto.locationCity ?? null,
        locationRegion: dto.locationRegion ?? null,
        locationCountry: dto.locationCountry ?? null,
      },
    );

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.personal_updated",
      entityType: "candidate_profile",
      entityId: user.id,
      ...requestMeta,
    });

    // Personal fields (headline, summary, location) feed into Profile Score
    // signals — mark the current score stale + enqueue a recompute. No-op
    // when the candidate has no default resume yet.
    await this.markScoreStaleAndEnqueueRecompute(user.id, "profile_change");

    return this.toResponse(profile, candidateProfile);
  }

  async updatePreferences(
    user: AuthUser,
    dto: UpdateCandidatePreferencesDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    // Profile row isn't being mutated here, so the SELECT can run in parallel
    // with the candidate_profiles UPDATE.
    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.updateCandidateProfile(user.id, {
        desiredRoles: dto.desiredRoles,
        desiredSeniority: dto.desiredSeniority ?? null,
        openTo: dto.openTo,
        desiredSalaryMin: dto.desiredSalaryMin != null ? String(dto.desiredSalaryMin) : null,
        desiredSalaryMax: dto.desiredSalaryMax != null ? String(dto.desiredSalaryMax) : null,
        desiredCurrency: dto.desiredCurrency,
        availableStartDate: dto.availableStartDate ?? null,
      }),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.preferences_updated",
      entityType: "candidate_profile",
      entityId: user.id,
      ...requestMeta,
    });

    // Job preferences (desired roles, seniority, salary band, currency, start
    // date) feed into Profile Score weighting — mark stale + recompute.
    await this.markScoreStaleAndEnqueueRecompute(user.id, "preferences_change");

    return this.toResponse(profile, candidateProfile);
  }

  async complete(
    user: AuthUser,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CandidateProfileMeDto> {
    this.assertCandidate(user);

    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.updateCandidateProfile(user.id, { profileCompleted: true }),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.completed",
      entityType: "candidate_profile",
      entityId: user.id,
      details: { role: "candidate" },
      ...requestMeta,
    });

    return this.toResponse(profile, candidateProfile);
  }

  /**
   * Validates per-step onboarding minimums (personal → review → preferences),
   * then sets `profileCompleted = true` and writes an audit log. Used by the
   * wizard's Finish button — gives the backend defense-in-depth on top of
   * frontend validation, plus a dedicated audit marker for "onboarding completed."
   *
   * Experience / education / skill counts are derived from the candidate's
   * default resume's `parsedData` (mirrors `ScoringService.computeProfileScore`,
   * which also reads experiences/educations/skills from the default resume).
   *
   * Phase 1 proactive system (Tasks 10 + 11): once validation passes and the
   * profile is marked complete, this method also:
   *   - Synchronously runs `ScoringService.computeProfileScore` so the
   *     analyzing screen can land on the candidate dashboard with a real
   *     Profile Score in hand instead of an empty shimmer.
   *   - Enqueues the existing match-preview-precompute BullMQ job so the
   *     "Recommended for you" feed populates while the candidate is still
   *     in the analyzing screen.
   *   - Falls back gracefully when the inline AI call throws
   *     (`errors.profileScore = "transient"`) and enqueues a profile-score
   *     recompute job so a fresh score lands on the dashboard once the
   *     worker retries. The candidate is NEVER trapped in onboarding limbo
   *     by an AI failure — `profile_completed` is flipped before the AI
   *     call, and the AI call's failure is reported in the response body
   *     rather than as an HTTP error.
   */
  async completeOnboarding(
    user: AuthUser,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<CompleteOnboardingDto> {
    this.assertCandidate(user);

    const [profile, candidateProfile] = await Promise.all([
      this.repo.findById(user.id),
      this.repo.findCandidateProfile(user.id),
    ]);
    if (!profile) {
      throw new NotFoundException({ code: "PROFILE_NOT_FOUND", message: "Profile missing" });
    }
    if (!candidateProfile) {
      throw new NotFoundException({
        code: "CANDIDATE_PROFILE_NOT_FOUND",
        message: "Candidate profile missing — re-register",
      });
    }

    // Step 1 — personal: must have a non-empty fullName.
    const personalParsed = personalCompleteSchema.safeParse({
      fullName: profile.fullName ?? "",
    });
    if (!personalParsed.success) {
      throw new BadRequestException({
        code: "INCOMPLETE_PERSONAL",
        message: "Add your full name before completing onboarding",
      });
    }

    // Step 2 — review: derive experience/education/skill counts from the
    // candidate's default resume's parsed data (resumes are the source of
    // truth for these arrays; there is no separate `candidate_experiences`
    // table). Mirrors the read pattern used in ScoringService.
    const defaultResume = await this.resumesRepo.findDefaultByCandidateId(user.id);
    const parsed =
      defaultResume?.parseStatus === "parsed" && defaultResume.parsedData
        ? (defaultResume.parsedData as unknown as ParsedResume)
        : null;
    const experienceCount = parsed?.experience?.length ?? 0;
    const educationCount = parsed?.education?.length ?? 0;
    const skillsCount = parsed?.skills?.length ?? 0;

    const reviewParsed = reviewCompleteSchema.safeParse({
      experienceCount,
      educationCount,
      skillsCount,
    });
    if (!reviewParsed.success) {
      throw new BadRequestException({
        code: "INCOMPLETE_REVIEW",
        message: "Add at least one experience, one school, or three skills",
      });
    }

    // Step 3 — preferences: must have at least one desired role. Open-to /
    // salary / start date stay optional; without a target role there's
    // nothing to score the candidate against.
    const preferencesParsed = preferencesCompleteSchema.safeParse({
      desiredRoles: candidateProfile.desiredRoles,
    });
    if (!preferencesParsed.success) {
      throw new BadRequestException({
        code: "INCOMPLETE_PREFERENCES",
        message: "Add at least one desired role before completing onboarding",
      });
    }

    // Mark profile completed BEFORE the AI call. If the inline Profile
    // Score compute below throws, the candidate must NOT be trapped in
    // onboarding limbo — the AI failure is surfaced in the response body
    // and a recompute job is enqueued for retry.
    const updatedCandidateProfile = await this.repo.updateCandidateProfile(user.id, {
      profileCompleted: true,
    });

    void this.audit.log({
      actorId: user.id,
      actorType: "user",
      action: "user.onboarding.completed",
      entityType: "candidate_profile",
      entityId: user.id,
      details: { role: "candidate", source: "complete-onboarding" },
      ...requestMeta,
    });

    let profileScore: ProfileScoreDto | null = null;
    let precomputeJobId = "";
    let profileScoreError: ProfileScoreError | undefined;

    if (!defaultResume) {
      // Frontend validation should make this path unreachable (review-step
      // gate already requires a parsed resume), but defense-in-depth: with
      // no resume there's nothing for the AI to score, so skip the call
      // entirely rather than enqueue a doomed retry.
      profileScoreError = "missing_resume";
    } else {
      // Match-preview precompute fires regardless of Profile Score success
      // — it's a separate AI surface (Recommended-for-you feed) that
      // shouldn't be gated on Profile Score health. Soft-fail to "" when
      // BullMQ declines to assign an id; the response shape stays valid
      // and the worker still has the chance to run if enqueue did succeed.
      precomputeJobId =
        (await this.matchPreviewQueue.enqueuePrecompute({
          candidateId: user.id,
          resumeId: defaultResume.id,
        })) ?? "";

      try {
        profileScore = await this.scoring.computeProfileScore(
          user.id,
          defaultResume.id,
          { reason: "onboarding", requestMeta },
        );
      } catch (err) {
        this.logger.warn(
          `Inline profile-score compute failed during onboarding for candidate ${user.id}: ${(err as Error).message}`,
        );
        profileScoreError = "transient";
        // Enqueue a recompute so a fresh score lands on the dashboard once
        // the worker retries; the candidate sees a "score will appear
        // shortly" nudge rather than a dead stat.
        await this.profileScoreQueue.enqueueRecompute({
          candidateId: user.id,
          resumeId: defaultResume.id,
          reason: "onboarding",
        });
      }
    }

    return {
      profile: this.toResponse(profile, updatedCandidateProfile),
      profileCompleted: true,
      profileScore,
      precomputeJobId,
      ...(profileScoreError ? { errors: { profileScore: profileScoreError } } : {}),
    };
  }

  /**
   * Shared "Profile Score is stale" hook used by both `updatePersonal` and
   * `updatePreferences`. Mirrors the stale + enqueue subset of
   * `ResumesService.applyDefaultChange` (Task 6/7) — but we don't need the
   * default-flag flip or match-preview cascade here, since the resume itself
   * isn't changing.
   *
   * Short-circuits when the candidate has no default resume: there's nothing
   * to score against, so emitting a job would just produce a worker no-op.
   *
   * The stale_at update only touches rows where stale_at IS NULL so a flurry
   * of edits in the same UI flow doesn't keep resetting the timestamp on
   * already-stale rows.
   */
  private async markScoreStaleAndEnqueueRecompute(
    candidateId: string,
    reason: ProfileScoreRecomputeReason,
  ): Promise<void> {
    const defaultResume = await this.resumesRepo.findDefaultByCandidateId(candidateId);
    if (!defaultResume) return;

    try {
      await this.db
        .update(profileScoresTable)
        .set({ staleAt: new Date() })
        .where(
          and(
            eq(profileScoresTable.candidateId, candidateId),
            isNull(profileScoresTable.staleAt),
          ),
        );
    } catch (err) {
      // Don't let a stale-marker write failure roll back the user's profile
      // edit — the recompute job below will still produce a fresh row, and
      // the worker treats UPSERT as the source of truth.
      this.logger.warn(
        `Failed to mark profile_scores stale for candidate=${candidateId}: ${(err as Error).message}`,
      );
    }

    await this.profileScoreQueue.enqueueRecompute({
      candidateId,
      resumeId: defaultResume.id,
      reason,
    });
  }

  private assertCandidate(user: AuthUser): void {
    if (user.role !== "candidate") {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "Candidate role required" });
    }
  }

  private toResponse(profile: Profile, candidateProfile: CandidateProfile): CandidateProfileMeDto {
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      headline: candidateProfile.headline,
      summary: candidateProfile.summary,
      locationCity: candidateProfile.locationCity,
      locationRegion: candidateProfile.locationRegion,
      locationCountry: candidateProfile.locationCountry,
      desiredRoles: candidateProfile.desiredRoles,
      desiredSeniority: candidateProfile.desiredSeniority,
      openTo: candidateProfile.openTo,
      desiredSalaryMin: candidateProfile.desiredSalaryMin
        ? Number(candidateProfile.desiredSalaryMin)
        : null,
      desiredSalaryMax: candidateProfile.desiredSalaryMax
        ? Number(candidateProfile.desiredSalaryMax)
        : null,
      desiredCurrency: candidateProfile.desiredCurrency ?? "USD",
      availableStartDate: candidateProfile.availableStartDate
        ? candidateProfile.availableStartDate.toString()
        : null,
      profileCompleted: candidateProfile.profileCompleted,
    };
  }
}
