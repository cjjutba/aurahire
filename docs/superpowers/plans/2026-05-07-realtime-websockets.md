# Real-time WebSockets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Socket.io-based real-time event channel between the NestJS backend and the Next.js frontend so that three thesis-defining surfaces (recruiter pipeline, candidate application status, admin audit feed) update without page refreshes — using semantic events emitted by the backend on every consequential mutation.

**Architecture:**

- **Backend:** New `apps/api/src/realtime/` module (global) exporting an injectable `EventsService`. A `RealtimeGateway` (`@nestjs/websockets` + `@nestjs/platform-socket.io`) terminates connections, validates the Supabase JWT in the handshake using the same `jose` JWKS verifier as `SupabaseAuthGuard` (extracted into a shared util), and manages four room types (`user:{id}`, `recruiter:{id}`, `job:{id}`, `role:admin`). Mutating services (`ApplicationsService`, `InterviewsService`, `OffersService`, `BiasService`, `AuditService`) inject `EventsService` and call `emit*()` after a successful DB write. A `@socket.io/redis-adapter` is wired against the existing `REDIS_URL` so a future second Railway instance does not require re-architecture.
- **Frontend:** New `apps/web/lib/realtime/` library + `<SocketProvider>` mounted inside `<QueryProvider>` in the root layout. Two hooks — `useRealtimeChannel(event, handler)` for typed event listeners and `useRealtimeRoom('job', id)` for resource-scoped subscriptions. Event handlers call `queryClient.invalidateQueries` on the relevant keys from `apps/web/lib/query/keys.ts` (Pattern A — invalidate everywhere; surgical patches deferred). On JWT refresh the socket disconnects and reconnects with the new token; on reconnect, the handler also invalidates queries to recover from any missed events.

**Tech Stack:**

- **Backend:** NestJS 10, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `@socket.io/redis-adapter`, `ioredis` (already a dependency), `jose` (already a dependency for JWT verification).
- **Frontend:** `socket.io-client`, `@tanstack/react-query` (already at v5).
- **Shared:** Typed event names + payload schemas in `packages/shared/src/realtime/` (Zod-derived).
- **Verification:** No automated test harness for WebSockets in this repo (matches `redis-caching-strategy` plan precedent). Per-task verification = `pnpm tsc --noEmit` passes + `pnpm lint` passes. Per-phase verification = `pnpm build` passes + a manual smoke checklist the human runs (see Phase 6).

**Hard rules from CLAUDE.md that govern this plan:**

- Claude does NOT run dev servers, Docker commands, DB mutations, or deploys. The human runs `pnpm dev` and verifies all real-time behavior.
- Claude does NOT make billed external calls — N/A here, no AI calls in this plan.
- Claude does NOT run destructive or history-rewriting git commands. Per-task commits use `git add <specific paths>` + `git commit` (never `--amend`, never `--no-verify`).
- `pnpm tsc --noEmit` and `pnpm lint` are the automated gates Claude runs.

---

## Spec Reference

`docs/superpowers/specs/2026-05-07-realtime-websockets-design.md` — chosen mechanism (Socket.io over Supabase Realtime), three tier-1 surfaces, four room types, six events, security/RBAC model, failure modes, and the manual verification plan referenced in Phase 6.

---

## File Structure

| Path                                                                                                                                                   | Role                                                                                                                                                     | Touch              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `apps/api/src/common/auth/verify-supabase-jwt.ts`                                                                                                      | Extracted JWKS verify util — pure function shared by `SupabaseAuthGuard` and the WS gateway                                                              | Create             |
| `apps/api/src/common/guards/supabase-auth.guard.ts`                                                                                                    | Replace inline verify with the new util                                                                                                                  | Modify             |
| `apps/api/src/realtime/realtime.module.ts`                                                                                                             | `@Global()` module exporting `EventsService`                                                                                                             | Create             |
| `apps/api/src/realtime/realtime.gateway.ts`                                                                                                            | `@WebSocketGateway`; handles connection auth, room joins, `subscribe`/`unsubscribe` messages                                                             | Create             |
| `apps/api/src/realtime/events.service.ts`                                                                                                              | Injectable; `emitApplicationCreated`, `emitApplicationStatusChanged`, `emitInterviewScheduled`, `emitOfferSent`, `emitAuditEntry`, `emitBiasFlagCreated` | Create             |
| `apps/api/src/realtime/ws-jwt.util.ts`                                                                                                                 | Wraps `verify-supabase-jwt` + profile lookup for handshake auth                                                                                          | Create             |
| `apps/api/src/realtime/room.constants.ts`                                                                                                              | Room-key builders + event-name constants                                                                                                                 | Create             |
| `apps/api/src/realtime/redis-adapter.provider.ts`                                                                                                      | Pub/sub ioredis clients + Socket.io adapter wiring                                                                                                       | Create             |
| `apps/api/src/realtime/realtime-rate-limit.ts`                                                                                                         | Per-socket subscribe-message rate limiter                                                                                                                | Create             |
| `apps/api/src/realtime/index.ts`                                                                                                                       | Barrel                                                                                                                                                   | Create             |
| `apps/api/src/main.ts`                                                                                                                                 | `app.useWebSocketAdapter(...)` + Redis adapter wiring                                                                                                    | Modify             |
| `apps/api/src/app.module.ts`                                                                                                                           | Import `RealtimeModule`                                                                                                                                  | Modify             |
| `apps/api/src/modules/applications/applications.service.ts`                                                                                            | Inject `EventsService`; emit `application.created` after `create()`, `application.status_changed` after `updateStatus()`                                 | Modify             |
| `apps/api/src/modules/interviews/interviews.service.ts`                                                                                                | Inject `EventsService`; emit `interview.scheduled` after `schedule()`                                                                                    | Modify             |
| `apps/api/src/modules/offers/offers.service.ts`                                                                                                        | Inject `EventsService`; emit `offer.sent` after `create()`                                                                                               | Modify             |
| `apps/api/src/modules/bias/bias.service.ts`                                                                                                            | Inject `EventsService`; emit `bias.flag_created` after the flag-recording method commits                                                                 | Modify             |
| `apps/api/src/audit/audit.service.ts`                                                                                                                  | Inject `EventsService`; emit `audit.entry` after `log()` insert                                                                                          | Modify             |
| `apps/api/src/modules/applications/applications.module.ts`, `interviews.module.ts`, `offers.module.ts`, `bias/bias.module.ts`, `audit/audit.module.ts` | No imports needed (RealtimeModule is `@Global()`)                                                                                                        | No change expected |
| `apps/api/package.json`                                                                                                                                | Add `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@socket.io/redis-adapter`                                                                       | Modify             |
| `packages/shared/src/realtime/events.ts`                                                                                                               | Typed event names + Zod payload schemas                                                                                                                  | Create             |
| `packages/shared/src/realtime/index.ts`                                                                                                                | Barrel                                                                                                                                                   | Create             |
| `packages/shared/src/index.ts`                                                                                                                         | Re-export `realtime/*`                                                                                                                                   | Modify             |
| `apps/web/lib/realtime/client.ts`                                                                                                                      | `makeSocket(getToken)` factory + status enum                                                                                                             | Create             |
| `apps/web/lib/realtime/events.ts`                                                                                                                      | Re-exports event types from `@aurahire/shared/realtime`                                                                                                  | Create             |
| `apps/web/lib/realtime/rooms.ts`                                                                                                                       | Resource-scoped subscribe helpers                                                                                                                        | Create             |
| `apps/web/lib/realtime/index.ts`                                                                                                                       | Barrel                                                                                                                                                   | Create             |
| `apps/web/components/providers/socket-provider.tsx`                                                                                                    | React context, lifecycle, JWT-refresh handling                                                                                                           | Create             |
| `apps/web/hooks/use-realtime-channel.ts`                                                                                                               | Subscribes to a single event for the lifetime of the component                                                                                           | Create             |
| `apps/web/hooks/use-realtime-room.ts`                                                                                                                  | Subscribes/unsubscribes a resource-scoped room                                                                                                           | Create             |
| `apps/web/app/layout.tsx`                                                                                                                              | Mount `<SocketProvider>` inside `<QueryProvider>`                                                                                                        | Modify             |
| `apps/web/app/(recruiter)/recruiter/jobs/[id]/_applications-tab-client.tsx` (or equivalent client component on that page)                              | Add `useRealtimeRoom('job', id)` + invalidate handlers                                                                                                   | Modify             |
| `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`                                                                                             | Add `useRealtimeChannel` for recruiter feed events                                                                                                       | Modify             |
| `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx` and its client component                                                               | Add `useRealtimeChannel` for `application.status_changed`, `interview.scheduled`, `offer.sent`                                                           | Modify             |
| `apps/web/app/(candidate)/candidate/applications/page.tsx` client list                                                                                 | Same set of channels                                                                                                                                     | Modify             |
| `apps/web/app/(candidate)/candidate/interviews/page.tsx` client list                                                                                   | `interview.scheduled` channel                                                                                                                            | Modify             |
| `apps/web/app/(admin)/admin/audit/page.tsx` client component                                                                                           | `audit.entry` channel                                                                                                                                    | Modify             |
| `apps/web/app/(admin)/admin/page.tsx` Recent Audit Events widget client                                                                                | `audit.entry` channel                                                                                                                                    | Modify             |
| `apps/web/app/(admin)/admin/bias-monitor/page.tsx` client                                                                                              | `bias.flag_created` channel                                                                                                                              | Modify             |
| `apps/web/components/admin/connection-status-indicator.tsx`                                                                                            | Tiny status badge, admin-only (Phase 5 polish)                                                                                                           | Create             |
| `apps/web/components/layout/portal-sidebar.tsx`                                                                                                        | Conditionally render the indicator for admin role                                                                                                        | Modify             |
| `apps/web/package.json`                                                                                                                                | Add `socket.io-client`                                                                                                                                   | Modify             |

---

## Phase 0 — Foundation

### Task 1: Install backend + frontend dependencies

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install backend WebSocket packages**

Run:

```bash
pnpm --filter @aurahire/api add @nestjs/websockets @nestjs/platform-socket.io @socket.io/redis-adapter
```

Expected: three new entries in `apps/api/package.json` `dependencies`. `socket.io` is pulled in transitively by `@nestjs/platform-socket.io`. `pnpm-lock.yaml` is updated.

- [ ] **Step 2: Install frontend Socket.io client**

Run:

```bash
pnpm --filter @aurahire/web add socket.io-client
```

Expected: `socket.io-client` added to `apps/web/package.json` `dependencies`. `pnpm-lock.yaml` is updated.

- [ ] **Step 3: Verify lockfile is consistent**

Run:

```bash
pnpm install
```

Expected: "Already up to date" or near-zero changes. No errors.

- [ ] **Step 4: Type-check both apps**

Run:

```bash
pnpm --filter @aurahire/api type-check && pnpm --filter @aurahire/web type-check
```

Expected: both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(realtime): add socket.io dependencies for backend gateway and frontend client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Define shared real-time event types

**Files:**

- Create: `packages/shared/src/realtime/events.ts`
- Create: `packages/shared/src/realtime/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Confirm shared package barrel structure**

Run:

```bash
cat packages/shared/src/index.ts | head -40
```

Expected: a list of `export * from "./..."` lines. Note the convention (re-exports per subfolder).

- [ ] **Step 2: Create `events.ts` with the full event taxonomy**

Create `packages/shared/src/realtime/events.ts`:

```ts
import { z } from "zod";

import { APPLICATION_STATUS, BIAS_CATEGORY, INTERVIEW_FORMAT } from "../enums";

// Event names — the single source of truth used by both backend emitters and
// frontend listeners. Past-tense, dotted-namespace.
export const RealtimeEvent = {
  ApplicationCreated: "application.created",
  ApplicationStatusChanged: "application.status_changed",
  InterviewScheduled: "interview.scheduled",
  OfferSent: "offer.sent",
  AuditEntry: "audit.entry",
  BiasFlagCreated: "bias.flag_created",
} as const;

export type RealtimeEventName =
  (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

// Payload schemas. All IDs are uuids; timestamps are ISO strings (the wire format).
// Status/format/category fields use the canonical enum tuples to match the rest of
// packages/shared/src/schemas (consumers branch on these values; plain strings
// would force every consumer to narrow before use).
const isoDate = z.string().datetime();

export const applicationCreatedSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  createdAt: isoDate,
});
export type ApplicationCreatedPayload = z.infer<
  typeof applicationCreatedSchema
>;

export const applicationStatusChangedSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  previousStatus: z.enum(APPLICATION_STATUS),
  status: z.enum(APPLICATION_STATUS),
  changedAt: isoDate,
});
export type ApplicationStatusChangedPayload = z.infer<
  typeof applicationStatusChangedSchema
>;

export const interviewScheduledSchema = z.object({
  interviewId: z.string().uuid(),
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  scheduledFor: isoDate,
  format: z.enum(INTERVIEW_FORMAT),
});
export type InterviewScheduledPayload = z.infer<
  typeof interviewScheduledSchema
>;

export const offerSentSchema = z.object({
  offerId: z.string().uuid(),
  applicationId: z.string().uuid(),
  recruiterId: z.string().uuid(),
  candidateId: z.string().uuid(),
  sentAt: isoDate,
});
export type OfferSentPayload = z.infer<typeof offerSentSchema>;

// audit_logs.entityId is NOT NULL in the DB schema; only actorId is nullable
// (system-generated entries). The wire shape mirrors that.
export const auditEntrySchema = z.object({
  auditId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  createdAt: isoDate,
  summary: z.string(),
});
export type AuditEntryPayload = z.infer<typeof auditEntrySchema>;

export const biasFlagCreatedSchema = z.object({
  flagId: z.string().uuid(),
  jobId: z.string().uuid(),
  term: z.string(),
  category: z.enum(BIAS_CATEGORY),
  createdAt: isoDate,
});
export type BiasFlagCreatedPayload = z.infer<typeof biasFlagCreatedSchema>;

// A discriminated map of event-name → payload, useful for typing handlers.
export interface RealtimeEventPayloadMap {
  [RealtimeEvent.ApplicationCreated]: ApplicationCreatedPayload;
  [RealtimeEvent.ApplicationStatusChanged]: ApplicationStatusChangedPayload;
  [RealtimeEvent.InterviewScheduled]: InterviewScheduledPayload;
  [RealtimeEvent.OfferSent]: OfferSentPayload;
  [RealtimeEvent.AuditEntry]: AuditEntryPayload;
  [RealtimeEvent.BiasFlagCreated]: BiasFlagCreatedPayload;
}

// Subscription messages (client → server).
export const subscribeMessageSchema = z.object({
  resource: z.literal("job"),
  id: z.string().uuid(),
});
export type SubscribeMessage = z.infer<typeof subscribeMessageSchema>;
```

- [ ] **Step 3: Create the barrel**

Create `packages/shared/src/realtime/index.ts`:

```ts
export * from "./events";
```

- [ ] **Step 4: Re-export from the shared package root**

Read `packages/shared/src/index.ts`. Add this line in alphabetical position with the existing re-exports:

```ts
export * from "./realtime";
```

- [ ] **Step 5: Type-check**

Run:

```bash
pnpm --filter @aurahire/shared type-check 2>/dev/null || pnpm --filter @aurahire/api type-check
```

Expected: pass. (If `@aurahire/shared` has no `type-check` script, the api type-check exercises it transitively.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/realtime/ packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): add realtime event taxonomy with Zod payload schemas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Backend infrastructure

### Task 3: Extract Supabase JWT verifier into a shared util

**Files:**

- Create: `apps/api/src/common/auth/verify-supabase-jwt.ts`
- Modify: `apps/api/src/common/guards/supabase-auth.guard.ts`

- [ ] **Step 1: Create the shared verify util**

Create `apps/api/src/common/auth/verify-supabase-jwt.ts`:

```ts
import { Logger } from "@nestjs/common";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
} from "jose";

export interface SupabaseJwtVerifierOptions {
  supabaseUrl: string;
}

export interface SupabaseJwtVerifier {
  verify(token: string): Promise<JWTPayload>;
}

/**
 * Builds a verifier that validates Supabase-issued JWTs against the project's
 * JWKS. Used by both the REST guard (`SupabaseAuthGuard`) and the WebSocket
 * handshake — keeps a single source of truth for issuer/audience/JWKS caching.
 */
export function createSupabaseJwtVerifier(
  options: SupabaseJwtVerifierOptions,
): SupabaseJwtVerifier {
  const issuer = `${options.supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(
    new URL(`${options.supabaseUrl}/auth/v1/.well-known/jwks.json`),
    {
      cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
      cooldownDuration: 30_000,
    },
  );
  const logger = new Logger("SupabaseJwt");

  return {
    async verify(token: string): Promise<JWTPayload> {
      try {
        const result: JWTVerifyResult = await jwtVerify(token, jwks, {
          issuer,
          audience: "authenticated",
        });
        return result.payload;
      } catch (err) {
        logger.warn(`JWT verification failed: ${(err as Error).message}`);
        throw err;
      }
    },
  };
}
```

- [ ] **Step 2: Refactor `SupabaseAuthGuard` to use the util**

Read `apps/api/src/common/guards/supabase-auth.guard.ts` to confirm the current structure. Replace the constructor + `canActivate` JWT-verify lines so the guard delegates to the new util while keeping all other behavior (profile fetch, suspended/deleted checks, `req.user` attach) identical.

Edit the file:

```ts
// Top of file, alongside existing imports
import {
  createSupabaseJwtVerifier,
  type SupabaseJwtVerifier,
} from "../auth/verify-supabase-jwt";
```

Replace the field declarations and constructor body (currently lines ~22–41 per the spec — confirm before editing) with:

```ts
  private readonly verifier: SupabaseJwtVerifier;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {
    const supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.verifier = createSupabaseJwtVerifier({ supabaseUrl });
  }
```

Remove the now-unused `jwtVerify`, `createRemoteJWKSet`, and `JWTPayload` imports (keep `JWTPayload` if the rest of the file needs it).

In `canActivate`, replace the inline `try { result = await jwtVerify(...) }` block with:

```ts
let payload: JWTPayload;
try {
  payload = await this.verifier.verify(token);
} catch {
  throw new UnauthorizedException({
    code: "INVALID_TOKEN",
    message: "Invalid or expired token",
  });
}
```

(The `try/catch` keeps the same `UnauthorizedException` shape; the verifier already logs the underlying reason.)

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass. If `JWTPayload` is no longer used anywhere in `supabase-auth.guard.ts`, drop the import.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/auth/verify-supabase-jwt.ts apps/api/src/common/guards/supabase-auth.guard.ts
git commit -m "$(cat <<'EOF'
refactor(api): extract Supabase JWT verifier into shared util

Prep for WebSocket gateway reuse — same JWKS, issuer, audience as the REST guard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Scaffold the realtime module — constants, JWT util, rate limit

**Files:**

- Create: `apps/api/src/realtime/room.constants.ts`
- Create: `apps/api/src/realtime/ws-jwt.util.ts`
- Create: `apps/api/src/realtime/realtime-rate-limit.ts`
- Create: `apps/api/src/realtime/index.ts`

- [ ] **Step 1: Create room + event constants**

Create `apps/api/src/realtime/room.constants.ts`:

```ts
import { RealtimeEvent } from "@aurahire/shared";

/**
 * Room key builders. Keep these centralized so both gateway joins and
 * EventsService emits agree on naming.
 */
export const Rooms = {
  user: (userId: string): string => `user:${userId}`,
  recruiter: (recruiterId: string): string => `recruiter:${recruiterId}`,
  job: (jobId: string): string => `job:${jobId}`,
  roleAdmin: (): string => `role:admin`,
} as const;

/**
 * Re-exported for backend code paths that don't otherwise import from
 * @aurahire/shared.
 */
export const Events = RealtimeEvent;
```

- [ ] **Step 2: Create the WS JWT util (handshake auth + profile lookup)**

Create `apps/api/src/realtime/ws-jwt.util.ts`:

```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import type { JWTPayload } from "jose";
import { profilesTable } from "@aurahire/db";
import type { AuthUser } from "@aurahire/shared";

import {
  createSupabaseJwtVerifier,
  type SupabaseJwtVerifier,
} from "../common/auth/verify-supabase-jwt";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";

@Injectable()
export class WsJwtUtil {
  private readonly logger = new Logger(WsJwtUtil.name);
  private readonly verifier: SupabaseJwtVerifier;

  constructor(
    private readonly config: ConfigService,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {
    const supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.verifier = createSupabaseJwtVerifier({ supabaseUrl });
  }

  /**
   * Verifies the JWT from a Socket.io handshake and returns the AuthUser, or
   * null on any failure (invalid token, missing profile, suspended account).
   * Logs at warn level for ops visibility but does not throw — the gateway
   * decides what to do with a null (disconnect).
   */
  async authenticate(token: string | undefined): Promise<AuthUser | null> {
    if (!token || typeof token !== "string") return null;

    let payload: JWTPayload;
    try {
      payload = await this.verifier.verify(token);
    } catch {
      return null;
    }

    const userId = payload.sub;
    if (!userId || typeof userId !== "string") return null;

    const rows = await this.db
      .select({
        id: profilesTable.id,
        email: profilesTable.email,
        role: profilesTable.role,
        status: profilesTable.status,
        fullName: profilesTable.fullName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);

    const profile = rows[0];
    if (!profile) {
      this.logger.warn(`WS handshake rejected: profile missing for ${userId}`);
      return null;
    }
    if (profile.status === "suspended" || profile.status === "deleted") {
      this.logger.warn(
        `WS handshake rejected: account ${profile.status} for ${userId}`,
      );
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      fullName: profile.fullName,
      profileCompleted: true,
    };
  }
}
```

- [ ] **Step 3: Create the per-socket subscribe-message rate limiter**

Create `apps/api/src/realtime/realtime-rate-limit.ts`:

```ts
/**
 * Tiny in-memory token-bucket-style limiter, scoped per Socket.io client id.
 * Used only for inbound `subscribe`/`unsubscribe` messages — server-emitted
 * events are server-trusted and unlimited.
 *
 * Limit: 30 messages per 60s rolling window per socket. Tuning is intentional:
 * the only legitimate use is a few subscribes per page nav, so even noisy SPAs
 * stay well under.
 */
export class SocketRateLimiter {
  private readonly windowMs = 60_000;
  private readonly limit = 30;
  private readonly hits = new Map<string, number[]>();

  /**
   * Returns true if the message is allowed; false if the socket is over its
   * budget for the current window. The gateway disconnects on false.
   */
  allow(socketId: string): boolean {
    const now = Date.now();
    const bucket = this.hits.get(socketId) ?? [];
    const fresh = bucket.filter((ts) => now - ts < this.windowMs);
    if (fresh.length >= this.limit) {
      this.hits.set(socketId, fresh);
      return false;
    }
    fresh.push(now);
    this.hits.set(socketId, fresh);
    return true;
  }

  forget(socketId: string): void {
    this.hits.delete(socketId);
  }
}
```

- [ ] **Step 4: Create the barrel**

Create `apps/api/src/realtime/index.ts`:

```ts
export * from "./events.service";
export * from "./room.constants";
export { RealtimeModule } from "./realtime.module";
```

(`events.service.ts` and `realtime.module.ts` are created in the next two tasks — the barrel will fail to type-check until then; that is expected.)

- [ ] **Step 5: Commit (partial — barrel intentionally not yet resolvable)**

```bash
git add apps/api/src/realtime/room.constants.ts apps/api/src/realtime/ws-jwt.util.ts apps/api/src/realtime/realtime-rate-limit.ts apps/api/src/realtime/index.ts
git commit -m "$(cat <<'EOF'
feat(api): scaffold realtime module — constants, JWT util, rate limiter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Implement `EventsService`

**Files:**

- Create: `apps/api/src/realtime/events.service.ts`

- [ ] **Step 1: Write the service**

Create `apps/api/src/realtime/events.service.ts`:

```ts
import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import {
  RealtimeEvent,
  type ApplicationCreatedPayload,
  type ApplicationStatusChangedPayload,
  type AuditEntryPayload,
  type BiasFlagCreatedPayload,
  type InterviewScheduledPayload,
  type OfferSentPayload,
} from "@aurahire/shared";

import { Rooms } from "./room.constants";
import { RealtimeGateway } from "./realtime.gateway";

/**
 * The injectable that mutating services call after a successful DB write.
 *
 * Discipline:
 *  - Emission failures are caught and logged; they NEVER propagate to the
 *    caller. The DB write already succeeded; a missed broadcast degrades to
 *    "user refreshes to see it."
 *  - Emissions run through `setImmediate` so the controller response is not
 *    blocked by socket I/O.
 *  - Room targets are computed inside this service so callers don't reach
 *    into Socket.io directly.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    // forwardRef breaks the gateway↔service circular import.
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly gateway: RealtimeGateway,
  ) {}

  emitApplicationCreated(payload: ApplicationCreatedPayload): void {
    this.broadcast(RealtimeEvent.ApplicationCreated, payload, [
      Rooms.recruiter(payload.recruiterId),
      Rooms.job(payload.jobId),
    ]);
  }

  emitApplicationStatusChanged(payload: ApplicationStatusChangedPayload): void {
    this.broadcast(RealtimeEvent.ApplicationStatusChanged, payload, [
      Rooms.user(payload.candidateId),
      Rooms.recruiter(payload.recruiterId),
      Rooms.job(payload.jobId),
    ]);
  }

  emitInterviewScheduled(payload: InterviewScheduledPayload): void {
    this.broadcast(RealtimeEvent.InterviewScheduled, payload, [
      Rooms.user(payload.candidateId),
      Rooms.recruiter(payload.recruiterId),
    ]);
  }

  emitOfferSent(payload: OfferSentPayload): void {
    this.broadcast(RealtimeEvent.OfferSent, payload, [
      Rooms.user(payload.candidateId),
      Rooms.recruiter(payload.recruiterId),
    ]);
  }

  emitAuditEntry(payload: AuditEntryPayload): void {
    this.broadcast(RealtimeEvent.AuditEntry, payload, [Rooms.roleAdmin()]);
  }

  emitBiasFlagCreated(payload: BiasFlagCreatedPayload): void {
    this.broadcast(RealtimeEvent.BiasFlagCreated, payload, [Rooms.roleAdmin()]);
  }

  private broadcast(
    event: string,
    payload: unknown,
    rooms: readonly string[],
  ): void {
    setImmediate(() => {
      try {
        const server = this.gateway.server;
        if (!server) {
          // Gateway not yet initialized (boot path or test); silently drop.
          return;
        }
        server.to([...rooms]).emit(event, payload);
      } catch (err) {
        this.logger.warn(
          `Realtime emit failed for ${event}: ${(err as Error).message}`,
        );
      }
    });
  }
}
```

- [ ] **Step 2: Stage commit (defer until gateway exists for a clean type-check)**

This file references `RealtimeGateway` which is created in Task 6. Do not run type-check yet; proceed to Task 6 in the same working tree.

---

### Task 6: Implement `RealtimeGateway`

**Files:**

- Create: `apps/api/src/realtime/realtime.gateway.ts`

- [ ] **Step 1: Write the gateway**

Create `apps/api/src/realtime/realtime.gateway.ts`:

```ts
import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { eq, and } from "drizzle-orm";
import { jobsTable } from "@aurahire/db";
import {
  type AuthUser,
  type SubscribeMessage as SubscribeMessageType,
  subscribeMessageSchema,
} from "@aurahire/shared";

import { Rooms } from "./room.constants";
import { WsJwtUtil } from "./ws-jwt.util";
import { SocketRateLimiter } from "./realtime-rate-limit";
import { Inject } from "@nestjs/common";
import { DRIZZLE_CLIENT, type DrizzleClient } from "../db/db.module";

interface SocketData {
  user?: AuthUser;
}
type AuthSocket = Socket<unknown, unknown, unknown, SocketData>;

/**
 * Single Socket.io entry point for the API.
 *
 * Responsibilities:
 *  - Authenticate the JWT presented in the handshake (`auth.token`).
 *  - Auto-join role-scoped rooms on connect.
 *  - Validate ownership before joining resource-scoped rooms (`subscribe`).
 *  - Publish the io server instance for `EventsService` to broadcast against.
 */
@WebSocketGateway({
  cors: {
    origin: (origin, cb) => {
      const allowed = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
        .split(",")
        .map((o) => o.trim());
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error("CORS"), false);
    },
    credentials: true,
  },
  path: "/socket.io",
  transports: ["websocket", "polling"],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly limiter = new SocketRateLimiter();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: WsJwtUtil,
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.logger.log("Realtime gateway initialized");
  }

  async handleConnection(client: AuthSocket): Promise<void> {
    const token =
      typeof client.handshake.auth?.token === "string"
        ? (client.handshake.auth.token as string)
        : undefined;
    const user = await this.jwt.authenticate(token);
    if (!user) {
      this.logger.warn(`WS handshake rejected (auth) for client ${client.id}`);
      client.emit("connect_error", { code: "UNAUTHORIZED" });
      client.disconnect(true);
      return;
    }

    client.data.user = user;

    const joined: string[] = [];
    void client.join(Rooms.user(user.id));
    joined.push(Rooms.user(user.id));

    if (user.role === "recruiter") {
      void client.join(Rooms.recruiter(user.id));
      joined.push(Rooms.recruiter(user.id));
    }
    if (user.role === "admin") {
      void client.join(Rooms.roleAdmin());
      joined.push(Rooms.roleAdmin());
    }

    client.emit("connected", {
      userId: user.id,
      role: user.role,
      joinedRooms: joined,
    });

    this.logger.log(
      `WS connect ${client.id} user=${user.id} role=${user.role} rooms=${joined.length}`,
    );
  }

  handleDisconnect(client: AuthSocket): void {
    this.limiter.forget(client.id);
    const userId = client.data.user?.id ?? "anon";
    this.logger.log(`WS disconnect ${client.id} user=${userId}`);
  }

  @SubscribeMessage("subscribe")
  async onSubscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    if (!this.limiter.allow(client.id)) {
      client.emit("subscribe_error", { reason: "rate_limited" });
      client.disconnect(true);
      return;
    }
    const user = client.data.user;
    if (!user) {
      client.emit("subscribe_error", { reason: "unauthorized" });
      return;
    }

    const parsed = subscribeMessageSchema.safeParse(body);
    if (!parsed.success) {
      client.emit("subscribe_error", { reason: "invalid_payload" });
      return;
    }
    const msg: SubscribeMessageType = parsed.data;

    const allowed = await this.canAccessResource(user, msg);
    if (!allowed) {
      client.emit("subscribe_error", {
        resource: msg.resource,
        id: msg.id,
        reason: "forbidden",
      });
      return;
    }

    const room = this.roomForResource(msg);
    if (!room) {
      client.emit("subscribe_error", {
        resource: msg.resource,
        id: msg.id,
        reason: "unknown_resource",
      });
      return;
    }
    void client.join(room);
    client.emit("subscribed", { resource: msg.resource, id: msg.id });
  }

  @SubscribeMessage("unsubscribe")
  onUnsubscribe(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: unknown,
  ): void {
    if (!this.limiter.allow(client.id)) {
      client.disconnect(true);
      return;
    }
    const parsed = subscribeMessageSchema.safeParse(body);
    if (!parsed.success) return;
    const room = this.roomForResource(parsed.data);
    if (room) void client.leave(room);
  }

  private roomForResource(msg: SubscribeMessageType): string | null {
    if (msg.resource === "job") return Rooms.job(msg.id);
    return null;
  }

  private async canAccessResource(
    user: AuthUser,
    msg: SubscribeMessageType,
  ): Promise<boolean> {
    if (msg.resource === "job") {
      // Admins can subscribe to any job.
      if (user.role === "admin") return true;
      // Recruiters can subscribe to jobs they own.
      if (user.role === "recruiter") {
        const rows = await this.db
          .select({ id: jobsTable.id })
          .from(jobsTable)
          .where(
            and(eq(jobsTable.id, msg.id), eq(jobsTable.recruiterId, user.id)),
          )
          .limit(1);
        return rows.length === 1;
      }
      return false;
    }
    return false;
  }
}
```

- [ ] **Step 2: Verify the `jobsTable` schema has `recruiterId` (or equivalent owner column)**

Run:

```bash
grep -n "recruiterId\|recruiter_id\|ownerId\|createdBy" packages/db/src/schemas/jobs*.ts 2>/dev/null
```

If the column has a different name (e.g., `createdBy`, `ownerId`), substitute the correct one in `canAccessResource`. If `jobsTable` is in a different file, update the import. The intent is "recruiter can subscribe to a job iff they own it."

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass. (`EventsService` from Task 5 is now resolvable too.)

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 5: Commit (gateway + events service together)**

```bash
git add apps/api/src/realtime/realtime.gateway.ts apps/api/src/realtime/events.service.ts
git commit -m "$(cat <<'EOF'
feat(api): implement realtime gateway and events service

- WebSocketGateway authenticates Supabase JWT in handshake, auto-joins
  user/recruiter/admin rooms on connect, validates ownership for resource
  subscribes (job rooms).
- EventsService exposes typed emit* methods used by mutating services.
  Emissions run via setImmediate, swallow errors, never block callers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire the Redis adapter

**Files:**

- Create: `apps/api/src/realtime/redis-adapter.provider.ts`

- [ ] **Step 1: Write the adapter provider**

Create `apps/api/src/realtime/redis-adapter.provider.ts`:

```ts
import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

/**
 * Custom Socket.io adapter that wires the @socket.io/redis-adapter against
 * the existing REDIS_URL. Required for cross-instance broadcast when we run
 * more than one Railway instance — even with one instance today, wiring this
 * from day one means scaling out is a redeploy, not a refactor.
 *
 * Falls back to the default in-memory adapter if REDIS_URL is unset (matches
 * the cache-module fail-open posture).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger("RedisIoAdapter");
  private pub?: Redis;
  private sub?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn(
        "REDIS_URL not set; Socket.io will use in-memory adapter (single-instance only)",
      );
      return;
    }
    // Pub/sub adapter needs distinct connections (Redis pub/sub blocks the conn).
    // lazyConnect:true so the awaited connect() actually blocks until the TCP
    // handshake completes — required because @socket.io/redis-adapter calls
    // psubscribe inside its constructor with enableOfflineQueue:false, and
    // that throws "Stream isn't writeable" if the sub isn't ready yet.
    this.pub = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(50 * 2 ** Math.min(times, 6), 2000),
    });
    this.sub = this.pub.duplicate();
    this.pub.on("error", (e) => this.logger.warn(`pub error: ${e.message}`));
    this.sub.on("error", (e) => this.logger.warn(`sub error: ${e.message}`));
    await Promise.all([this.pub.connect(), this.sub.connect()]);
    this.logger.log("Socket.io Redis adapter connected");
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: ReturnType<typeof createAdapter>) => void;
    };
    if (this.pub && this.sub) {
      server.adapter(createAdapter(this.pub, this.sub));
    }
    return server;
  }
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass. If `createIOServer` cast complains, prefer typing as `unknown` then narrowing rather than `any`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/realtime/redis-adapter.provider.ts
git commit -m "$(cat <<'EOF'
feat(api): wire socket.io redis adapter for multi-instance broadcast

Falls back to in-memory adapter when REDIS_URL is unset so local dev still
works without Redis. Mirrors the cache-module fail-open posture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Create `RealtimeModule` and wire into `AppModule` + `main.ts`

**Files:**

- Create: `apps/api/src/realtime/realtime.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Create the module**

Create `apps/api/src/realtime/realtime.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";

import { RealtimeGateway } from "./realtime.gateway";
import { EventsService } from "./events.service";
import { WsJwtUtil } from "./ws-jwt.util";

/**
 * Global module — feature modules inject `EventsService` without importing
 * this module explicitly. `DRIZZLE_CLIENT` and `ConfigService` come from the
 * already-global `DbModule` and `ConfigModule.forRoot({ isGlobal: true })`.
 */
@Global()
@Module({
  providers: [RealtimeGateway, EventsService, WsJwtUtil],
  exports: [EventsService],
})
export class RealtimeModule {}
```

- [ ] **Step 2: Register `RealtimeModule` in `AppModule`**

Read `apps/api/src/app.module.ts`. Add the import alongside existing module imports:

```ts
import { RealtimeModule } from "./realtime";
```

Add `RealtimeModule` to the `imports:` array in alphabetical position relative to existing modules (placement doesn't matter functionally; pick a spot that keeps the array readable, e.g., right after `AdminModule`).

- [ ] **Step 3: Wire the WebSocket adapter in `main.ts`**

Read `apps/api/src/main.ts`. Add the import:

```ts
import { RedisIoAdapter } from "./realtime/redis-adapter.provider";
```

After the existing CORS configuration block (around line 54) and before `app.setGlobalPrefix("api")`, add:

```ts
// WebSocket adapter — must run before listen(). Connects the Redis
// pub/sub backing for Socket.io rooms across instances.
const wsAdapter = new RedisIoAdapter(app);
await wsAdapter.connectToRedis();
app.useWebSocketAdapter(wsAdapter);
```

- [ ] **Step 4: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass.

- [ ] **Step 5: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 6: Build**

Run:

```bash
pnpm --filter @aurahire/api build
```

Expected: build succeeds, `dist/main.js` produced.

- [ ] **Step 7: Stop and ask the human for boot verification**

> **Human action required:** start the API (`pnpm dev` from repo root, or `pnpm --filter @aurahire/api dev`). Confirm the logs show:
>
> - `Realtime gateway initialized`
> - `Socket.io Redis adapter connected` (if `REDIS_URL` set) **or** the in-memory fallback warning (if unset)
> - `AuraHire API running at http://localhost:3333`
>
> If the API does not boot, paste the error here.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/realtime/realtime.module.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "$(cat <<'EOF'
feat(api): register RealtimeModule and useWebSocketAdapter on boot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Backend event emissions

### Task 9: Emit `application.created` and `application.status_changed`

**Files:**

- Modify: `apps/api/src/modules/applications/applications.service.ts`

- [ ] **Step 1: Read the file to find the exact `create()` and `updateStatus()` boundaries**

Run:

```bash
grep -n "async create\|async updateStatus\|async withdraw" apps/api/src/modules/applications/applications.service.ts
```

Note the line numbers. `updateStatus` is around line 475 per the spec; confirm. Note the field names used to read the inserted/updated row (`id`, `jobId`, `recruiterId`, `candidateId`, `status`).

- [ ] **Step 2: Inject `EventsService`**

Add the import:

```ts
import { EventsService } from "../../realtime";
```

Add the constructor parameter (alongside existing `@Inject(...)` params):

```ts
    private readonly events: EventsService,
```

- [ ] **Step 3: Emit after `create()` commits**

Inside `create()`, immediately after the application row is successfully inserted (and the inserted row's id/columns are available to the method), add — right before the method returns:

```ts
this.events.emitApplicationCreated({
  applicationId: created.id,
  jobId: created.jobId,
  recruiterId: created.recruiterId,
  candidateId: created.candidateId,
  createdAt:
    created.createdAt instanceof Date
      ? created.createdAt.toISOString()
      : new Date(created.createdAt).toISOString(),
});
```

(Adjust `created` to whatever local variable holds the inserted row. If the service returns a DTO without these fields, fetch them from the row before mapping to the DTO.)

- [ ] **Step 4: Emit after `updateStatus()` commits**

Inside `updateStatus()`, after the status update commits and the state-machine transition has been validated, add:

```ts
this.events.emitApplicationStatusChanged({
  applicationId: updated.id,
  jobId: updated.jobId,
  recruiterId: updated.recruiterId,
  candidateId: updated.candidateId,
  previousStatus,
  status: updated.status,
  changedAt: new Date().toISOString(),
});
```

(`previousStatus` is whatever local variable holds the status before the update — if the method doesn't capture it, read it from the original row before the update and store in a local.)

- [ ] **Step 5: Repeat for `withdraw()` if present**

If `applications.service.ts` has a `withdraw()` method that updates status to `withdrawn`, add the same `emitApplicationStatusChanged` call (with `status: 'withdrawn'`) after the DB write.

- [ ] **Step 6: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass.

- [ ] **Step 7: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/applications/applications.service.ts
git commit -m "$(cat <<'EOF'
feat(api): emit application.created and application.status_changed events

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Emit `interview.scheduled` and `offer.sent`

**Files:**

- Modify: `apps/api/src/modules/interviews/interviews.service.ts`
- Modify: `apps/api/src/modules/offers/offers.service.ts`

- [ ] **Step 1: Inject + emit in `interviews.service.ts`**

Read `apps/api/src/modules/interviews/interviews.service.ts`. Locate the `schedule()` method (line 52 per earlier grep). Inject `EventsService`:

```ts
import { EventsService } from "../../realtime";
// constructor:
    private readonly events: EventsService,
```

After the interview row inserts successfully, before returning, add:

```ts
this.events.emitInterviewScheduled({
  interviewId: created.id,
  applicationId: created.applicationId,
  jobId: created.jobId,
  recruiterId: created.recruiterId,
  candidateId: created.candidateId,
  scheduledFor:
    created.scheduledFor instanceof Date
      ? created.scheduledFor.toISOString()
      : new Date(created.scheduledFor).toISOString(),
  format: created.format,
});
```

If the column names differ (e.g., `interviewerId` instead of `recruiterId`, `startsAt` instead of `scheduledFor`), substitute. The contract is: every payload field defined in `interviewScheduledSchema` must be populated.

- [ ] **Step 2: Inject + emit in `offers.service.ts`**

Read `apps/api/src/modules/offers/offers.service.ts`. Locate the `create()` method (line 46 per earlier grep — this is the "send offer" method per the spec naming). Inject `EventsService`:

```ts
import { EventsService } from "../../realtime";
// constructor:
    private readonly events: EventsService,
```

After the offer row inserts and the email side-effect dispatches, add:

```ts
this.events.emitOfferSent({
  offerId: created.id,
  applicationId: created.applicationId,
  recruiterId: created.recruiterId,
  candidateId: created.candidateId,
  sentAt: new Date().toISOString(),
});
```

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/interviews/interviews.service.ts apps/api/src/modules/offers/offers.service.ts
git commit -m "$(cat <<'EOF'
feat(api): emit interview.scheduled and offer.sent events

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Emit `audit.entry` and `bias.flag_created`

**Files:**

- Modify: `apps/api/src/audit/audit.service.ts`
- Modify: `apps/api/src/modules/bias/bias.service.ts`

- [ ] **Step 1: Read `audit.service.ts` and modify `log()`**

The current implementation (35 lines) inserts into `auditLogsTable` then catches errors. To capture the inserted id, change the insert to return columns. Replace the body of `log()`:

```ts
  async log(input: AuditLogInput): Promise<void> {
    try {
      const inserted = await this.db
        .insert(auditLogsTable)
        .values({
          actorId: input.actorId,
          actorType: input.actorType,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          companyId: input.companyId ?? null,
          details: input.details ?? {},
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })
        .returning({
          id: auditLogsTable.id,
          createdAt: auditLogsTable.createdAt,
        });

      const row = inserted[0];
      if (row) {
        this.events.emitAuditEntry({
          auditId: row.id,
          actorId: input.actorId ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : new Date(row.createdAt).toISOString(),
          summary: `${input.action} on ${input.entityType}`,
        });
      }
    } catch (err) {
      this.logger.error(
        `Audit write failed for action=${input.action} entity=${input.entityType}:${input.entityId}: ${(err as Error).message}`,
      );
    }
  }
```

Add the constructor injection:

```ts
import { EventsService } from "../realtime";
// constructor:
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly events: EventsService,
  ) {}
```

(`summary` is intentionally a simple `action on entityType` line — the audit page renders detail from the row itself when the user clicks through. Richer summaries can come later without breaking the schema.)

- [ ] **Step 2: Read `bias.service.ts` and find the flag-recording method**

Run:

```bash
grep -n "async \w\+\s*(" apps/api/src/modules/bias/bias.service.ts | head -20
```

Identify the method that inserts a bias-flag row (likely something like `recordFlag`, `flag`, `create`, or part of `detect`). Read that method's body to see what columns are written and what id/timestamp can be returned.

- [ ] **Step 3: Inject `EventsService` + emit on flag creation**

Add at the top:

```ts
import { EventsService } from "../../realtime";
// constructor:
    private readonly events: EventsService,
```

After the flag row commits in the identified method, add:

```ts
this.events.emitBiasFlagCreated({
  flagId: created.id,
  jobId: created.jobId,
  term: created.term,
  category: created.category,
  createdAt:
    created.createdAt instanceof Date
      ? created.createdAt.toISOString()
      : new Date(created.createdAt).toISOString(),
});
```

If the bias service stores flags in a per-job JSON blob rather than a per-flag row (no individual `flagId`), emit one event per detected term using a deterministic key like `${jobId}:${term}` as `flagId` after first checking that the row exists. If unclear, ask the human before guessing.

- [ ] **Step 4: Type-check**

Run:

```bash
pnpm --filter @aurahire/api type-check
```

Expected: pass.

- [ ] **Step 5: Lint**

Run:

```bash
pnpm --filter @aurahire/api lint
```

Expected: pass.

- [ ] **Step 6: Build**

Run:

```bash
pnpm --filter @aurahire/api build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/audit/audit.service.ts apps/api/src/modules/bias/bias.service.ts
git commit -m "$(cat <<'EOF'
feat(api): emit audit.entry and bias.flag_created events

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Frontend infrastructure

### Task 12: Create `lib/realtime/*` (client + types + room helpers)

**Files:**

- Create: `apps/web/lib/realtime/client.ts`
- Create: `apps/web/lib/realtime/events.ts`
- Create: `apps/web/lib/realtime/rooms.ts`
- Create: `apps/web/lib/realtime/index.ts`

- [ ] **Step 1: Re-export shared event types**

Create `apps/web/lib/realtime/events.ts`:

```ts
export {
  RealtimeEvent,
  type RealtimeEventName,
  type RealtimeEventPayloadMap,
  type ApplicationCreatedPayload,
  type ApplicationStatusChangedPayload,
  type InterviewScheduledPayload,
  type OfferSentPayload,
  type AuditEntryPayload,
  type BiasFlagCreatedPayload,
  type SubscribeMessage,
} from "@aurahire/shared";
```

- [ ] **Step 2: Create the socket factory**

Create `apps/web/lib/realtime/client.ts`:

```ts
"use client";

import { io, type Socket } from "socket.io-client";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "unauthorized";

/**
 * Builds the websocket URL from NEXT_PUBLIC_API_URL. Socket.io accepts the
 * https/http origin directly and chooses ws/wss + transport internally.
 */
function buildSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  return apiUrl;
}

export interface MakeSocketOptions {
  getToken: () => string | null;
}

export function makeSocket(opts: MakeSocketOptions): Socket {
  return io(buildSocketUrl(), {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: (cb) => {
      const token = opts.getToken();
      cb({ token });
    },
  });
}
```

- [ ] **Step 3: Create the room helpers**

Create `apps/web/lib/realtime/rooms.ts`:

```ts
"use client";

import type { Socket } from "socket.io-client";

export interface SubscribeOptions {
  resource: "job";
  id: string;
}

/**
 * Sends a `subscribe` message to the server and returns a function that
 * sends the matching `unsubscribe`. Idempotent on the server — safe to call
 * after every reconnect.
 */
export function subscribeToResource(
  socket: Socket,
  opts: SubscribeOptions,
): () => void {
  socket.emit("subscribe", opts);
  return () => {
    socket.emit("unsubscribe", opts);
  };
}
```

- [ ] **Step 4: Create the barrel**

Create `apps/web/lib/realtime/index.ts`:

```ts
export * from "./client";
export * from "./events";
export * from "./rooms";
```

- [ ] **Step 5: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/realtime/
git commit -m "$(cat <<'EOF'
feat(web): add realtime client factory, event types, and room helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Create `<SocketProvider>`

**Files:**

- Create: `apps/web/components/providers/socket-provider.tsx`

- [ ] **Step 1: Read existing auth/token plumbing**

Run:

```bash
cat apps/web/components/providers/auth-token-provider.tsx
```

Identify the hook that exposes the current Supabase access token (likely `useAuthToken()` or similar). Note the exact import path and return shape.

- [ ] **Step 2: Create the provider**

Create `apps/web/components/providers/socket-provider.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";

import { makeSocket, type SocketStatus } from "@/lib/realtime";
import { useAuthToken } from "@/components/providers/auth-token-provider";

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  status: "idle",
});

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/**
 * Owns the singleton socket lifecycle for a tab.
 *
 * Lifecycle:
 *  - Token absent  → no socket. Status `idle`.
 *  - Token present → create socket, autoConnect=false, then connect.
 *  - Token rotated → disconnect + reconnect so the new token is presented at handshake.
 *  - User signs out → token becomes null → disconnect + null out the socket.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuthToken();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("idle");

  // We need a stable getter so the auth callback in makeSocket reads the
  // freshest token on every (re)connect, including post-refresh.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) {
      // Sign-out path: tear down the socket if any.
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setStatus("idle");
      }
      return;
    }

    // Lazy-create on first authenticated render.
    if (!socketRef.current) {
      const sock = makeSocket({ getToken: () => tokenRef.current });
      sock.on("connect", () => setStatus("connected"));
      sock.on("disconnect", () => setStatus("disconnected"));
      sock.on("connect_error", (err) => {
        const code =
          (err as { data?: { code?: string } }).data?.code ?? err.message;
        setStatus(code === "UNAUTHORIZED" ? "unauthorized" : "disconnected");
      });
      socketRef.current = sock;
      setStatus("connecting");
      sock.connect();
      return () => {
        sock.disconnect();
        socketRef.current = null;
      };
    }

    // Token rotation path: same socket instance, force a re-handshake so the
    // server validates the fresh token.
    const sock = socketRef.current;
    sock.disconnect();
    setStatus("connecting");
    sock.connect();
  }, [token]);

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, status }),
    [status],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
```

If the import path for the auth token hook differs (e.g., not `@/components/providers/auth-token-provider` or not exposed as `useAuthToken`), adjust both the import and the destructure. The contract is: get the current Supabase access token; re-render this provider when it changes.

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/providers/socket-provider.tsx
git commit -m "$(cat <<'EOF'
feat(web): add SocketProvider with token-refresh-aware lifecycle

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Create `useRealtimeChannel` and `useRealtimeRoom` hooks

**Files:**

- Create: `apps/web/hooks/use-realtime-channel.ts`
- Create: `apps/web/hooks/use-realtime-room.ts`

- [ ] **Step 1: Create `use-realtime-channel.ts`**

```ts
"use client";

import { useEffect } from "react";

import { useSocket } from "@/components/providers/socket-provider";
import type {
  RealtimeEventName,
  RealtimeEventPayloadMap,
} from "@/lib/realtime";

/**
 * Subscribe a typed handler to a single realtime event for the lifetime of
 * the calling component. The handler is wrapped in a try/catch so a buggy
 * caller cannot kill the socket.
 */
export function useRealtimeChannel<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventPayloadMap[E]) => void,
): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const wrapped = (payload: RealtimeEventPayloadMap[E]): void => {
      try {
        handler(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[realtime] handler error for ${event}`, err);
      }
    };
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
    // The handler is intentionally not in deps; consumers stabilize via
    // useCallback when they need to. Adding it would re-bind every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event]);
}
```

- [ ] **Step 2: Create `use-realtime-room.ts`**

```ts
"use client";

import { useEffect } from "react";

import { useSocket } from "@/components/providers/socket-provider";
import { subscribeToResource } from "@/lib/realtime";

type Resource = "job";

/**
 * Subscribes to a resource-scoped room (e.g., a single job) for the lifetime
 * of the calling component. Re-subscribes automatically on socket reconnect.
 *
 * Pass `id={null}` to no-op (useful when the parent renders before the id is known).
 */
export function useRealtimeRoom(resource: Resource, id: string | null): void {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !id) return;
    let cleanup: (() => void) | null = null;

    const subscribe = (): void => {
      cleanup?.();
      cleanup = subscribeToResource(socket, { resource, id });
    };

    subscribe();
    socket.on("connect", subscribe); // re-subscribe after reconnect

    return () => {
      socket.off("connect", subscribe);
      cleanup?.();
    };
  }, [socket, resource, id]);
}
```

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/use-realtime-channel.ts apps/web/hooks/use-realtime-room.ts
git commit -m "$(cat <<'EOF'
feat(web): add useRealtimeChannel and useRealtimeRoom hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Mount `<SocketProvider>` in the root layout

**Files:**

- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Read the current provider tree**

Run:

```bash
cat apps/web/app/layout.tsx
```

Identify where `<QueryProvider>` wraps children. The new `<SocketProvider>` mounts **inside** `<QueryProvider>` (so it can use the query client during invalidation) and **outside** `<ConfirmProvider>` and the rest. `<AuthTokenProvider>` must wrap `<SocketProvider>` since the provider depends on the auth token.

- [ ] **Step 2: Add the import**

```ts
import { SocketProvider } from "@/components/providers/socket-provider";
```

- [ ] **Step 3: Insert into the provider tree**

Wrap whatever currently sits inside `<QueryProvider>` with `<SocketProvider>`. The order should read top-down:

```tsx
<AuthTokenProvider>
  <QueryProvider>
    <SocketProvider>
      <ConfirmProvider>{/* existing children */}</ConfirmProvider>
    </SocketProvider>
  </QueryProvider>
</AuthTokenProvider>
```

If the existing tree has different providers (e.g., theme provider) the rule is: `<SocketProvider>` goes **after** `<AuthTokenProvider>` and `<QueryProvider>` and **around** any provider that might use `useSocket()` (so all of them).

- [ ] **Step 4: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 5: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 6: Build**

Run:

```bash
pnpm --filter @aurahire/web build
```

Expected: build succeeds.

- [ ] **Step 7: Stop and ask the human for connection verification**

> **Human action required:** with the API running (Phase 1 Task 8), start the web app (`pnpm dev` from repo root). Sign in as any role. Open browser devtools → Network → WS. Confirm:
>
> - A `/socket.io/?EIO=...` request opens.
> - The response shows a successful upgrade.
> - In the browser console there is no `connect_error` or `UNAUTHORIZED` entry.
> - In the API logs there is a `WS connect` line showing the user id, role, and joined-rooms count.
>
> Sign out. Confirm the socket disconnects (API log: `WS disconnect`).
>
> If anything fails, paste the relevant log + console output.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): mount SocketProvider in root layout inside QueryProvider

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Frontend surfaces

### Task 16: Surface 1 — recruiter pipeline live updates

**Files:**

- Modify: the client component on `apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx` that renders the Applications tab table
- Modify: `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx` (or the equivalent client component the recruiter dashboard uses to render its widgets)

- [ ] **Step 1: Locate the recruiter job-detail applications client component**

Run:

```bash
ls apps/web/app/\(recruiter\)/recruiter/jobs/\[id\]/
```

Identify the client component that renders the Applications tab — likely `_applications-tab-client.tsx` or referenced from `page.tsx`. Read the file to confirm it uses TanStack Query keys from `apps/web/lib/query/keys.ts` (`queryKeys.recruiterApplications.byJob`).

- [ ] **Step 2: Add live updates to the recruiter job-detail page**

In the identified client component, add at the top of the function body (after the existing query hooks):

```ts
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useRealtimeRoom } from "@/hooks/use-realtime-room";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { RealtimeEvent } from "@/lib/realtime";
```

Inside the component:

```tsx
const queryClient = useQueryClient();
useRealtimeRoom("job", jobId);

useRealtimeChannel(RealtimeEvent.ApplicationCreated, (payload) => {
  if (payload.jobId !== jobId) return;
  queryClient.invalidateQueries({
    queryKey: ["recruiter-applications", "by-job", jobId],
  });
});

useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, (payload) => {
  if (payload.jobId !== jobId) return;
  queryClient.invalidateQueries({
    queryKey: ["recruiter-applications", "by-job", jobId],
  });
});
```

(`jobId` should already be available from `useParams()` or page props. The query-key prefix matches the structure declared in `apps/web/lib/query/keys.ts`.)

- [ ] **Step 3: Add live updates to the recruiter dashboard**

Read `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx`. Add the same imports. Inside the dashboard component:

```tsx
const queryClient = useQueryClient();

const invalidateDashboard = (): void => {
  queryClient.invalidateQueries({ queryKey: ["recruiter-dashboard"] });
};

useRealtimeChannel(RealtimeEvent.ApplicationCreated, invalidateDashboard);
useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, invalidateDashboard);
```

(The `["recruiter-dashboard"]` prefix invalidates `stats`, `analytics`, and `recent` together since all three keys share the prefix.)

**Note:** an earlier draft of this plan also wired `RealtimeEvent.BiasFlagCreated` here. That was incorrect — `EventsService.emitBiasFlagCreated` broadcasts only to `Rooms.roleAdmin()` (see Phase 1 Task 5), so recruiters never receive that event. Subscribing to it on the recruiter dashboard would be dead code. If a future requirement is "recruiter sees their own jobs' bias flags live," the gateway-side change is to add `Rooms.recruiter(<owningRecruiter>)` as an additional target room in `emitBiasFlagCreated`, not to add the listener here.

- [ ] **Step 4: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 5: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 6: Stop and ask the human for surface-1 smoke**

> **Human action required:** open the recruiter portal at `/recruiter/jobs/<id>` (Applications tab) in one window. In another browser (or incognito), sign in as a candidate and submit an application to that job. Confirm the recruiter window:
>
> - Adds the new row to the table without manual refresh, within ~2s.
>
> Then on the recruiter dashboard `/recruiter`, confirm the pipeline funnel and Recent Activity widgets reflect the new application (after the next interval, since they may be cached briefly).

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(recruiter\)/recruiter/jobs/\[id\]/ apps/web/app/\(recruiter\)/recruiter/_dashboard-client.tsx
git commit -m "$(cat <<'EOF'
feat(web): live updates for recruiter pipeline (job detail + dashboard)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Surface 2 — candidate application status live updates

**Files:**

- Modify: client component on `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx`
- Modify: client component on `apps/web/app/(candidate)/candidate/applications/page.tsx`
- Modify: client component on `apps/web/app/(candidate)/candidate/interviews/page.tsx`

- [ ] **Step 1: Locate the candidate application-detail client component**

Run:

```bash
ls apps/web/app/\(candidate\)/candidate/applications/\[id\]/
```

Identify the client component that renders the application detail (Overview / Score Breakdown / Timeline tabs). Read it to confirm the query key for the single-application fetch.

- [ ] **Step 2: Wire channels into the application-detail client**

Add the imports (same as Task 16 Step 2). In the component body:

```tsx
const queryClient = useQueryClient();

useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, (payload) => {
  if (payload.applicationId !== applicationId) return;
  queryClient.invalidateQueries({
    queryKey: ["candidate-applications"],
  });
  // If a more specific single-application key exists, invalidate it too.
  queryClient.invalidateQueries({
    queryKey: ["candidate-application", applicationId],
  });
});

useRealtimeChannel(RealtimeEvent.InterviewScheduled, (payload) => {
  if (payload.applicationId !== applicationId) return;
  queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
  queryClient.invalidateQueries({ queryKey: ["candidate-interviews"] });
});

useRealtimeChannel(RealtimeEvent.OfferSent, (payload) => {
  if (payload.applicationId !== applicationId) return;
  queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
});
```

(`applicationId` comes from `useParams()` or page props.)

- [ ] **Step 3: Wire channels into the candidate applications-list client**

In the applications-list client component:

```tsx
const queryClient = useQueryClient();
const invalidateList = (): void => {
  queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
};
useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, invalidateList);
useRealtimeChannel(RealtimeEvent.OfferSent, invalidateList);
```

- [ ] **Step 4: Wire channels into the candidate interviews-list client**

```tsx
const queryClient = useQueryClient();
useRealtimeChannel(RealtimeEvent.InterviewScheduled, () => {
  queryClient.invalidateQueries({ queryKey: ["candidate-interviews"] });
});
```

- [ ] **Step 5: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 6: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 7: Stop and ask the human for surface-2 smoke**

> **Human action required:**
>
> 1. Open the candidate portal at `/candidate/applications/<id>` in window A.
> 2. Open the matching recruiter view at `/recruiter/applications/<id>` in window B (separate browser).
> 3. In window B, change the application status (Applied → Screening). Confirm window A's status chip + timeline updates without refresh.
> 4. Repeat: Screening → Interview, Interview → Offer.
> 5. In window B, schedule an interview. Confirm window A's `/candidate/interviews` tab (open in window C) shows the new interview.
> 6. In window B, send an offer. Confirm window A's application detail surfaces the offer.
>
> If any transition does not propagate, paste the API log line for that emit + the browser console.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(candidate\)/candidate/applications/ apps/web/app/\(candidate\)/candidate/interviews/
git commit -m "$(cat <<'EOF'
feat(web): live updates for candidate application status, interviews, and offers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Surface 3 — admin audit + bias monitor live updates

**Files:**

- Modify: client component on `apps/web/app/(admin)/admin/audit/page.tsx`
- Modify: client component on `apps/web/app/(admin)/admin/page.tsx` (Recent Audit Events widget)
- Modify: client component on `apps/web/app/(admin)/admin/bias-monitor/page.tsx`

- [ ] **Step 1: Locate the admin audit client component**

Run:

```bash
ls apps/web/app/\(admin\)/admin/audit/
```

Identify the client component that renders the audit-log table.

- [ ] **Step 2: Wire `audit.entry` into the admin audit page**

```tsx
const queryClient = useQueryClient();
useRealtimeChannel(RealtimeEvent.AuditEntry, () => {
  queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
});
```

(Confirm the actual key prefix used by reading the existing query in the file. If it's `["audit", ...]`, use that.)

- [ ] **Step 3: Wire `audit.entry` into the admin dashboard widget**

In the dashboard client component:

```tsx
const queryClient = useQueryClient();
useRealtimeChannel(RealtimeEvent.AuditEntry, () => {
  queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
});
useRealtimeChannel(RealtimeEvent.BiasFlagCreated, () => {
  queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
});
```

- [ ] **Step 4: Wire `bias.flag_created` into the bias monitor page**

```tsx
const queryClient = useQueryClient();
useRealtimeChannel(RealtimeEvent.BiasFlagCreated, () => {
  queryClient.invalidateQueries({ queryKey: ["admin-bias-monitor"] });
});
```

- [ ] **Step 5: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 6: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 7: Stop and ask the human for surface-3 smoke**

> **Human action required:**
>
> 1. Sign in as admin at `/admin/audit` in window A.
> 2. In window B, sign in as recruiter and take any auditable action (publish a job, change application status). Confirm window A's audit table prepends a new row within ~2s.
> 3. Open `/admin` Recent Audit Events widget in window A (refresh first to pick up state). Repeat the recruiter action; confirm the widget updates.
> 4. In window B, publish a JD with a flagged term ("rockstar") and override the bias flag. In window A, open `/admin/bias-monitor` and confirm the flag count increments without refresh.
>
> If any of the three surfaces does not update, paste the API log + browser console.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(admin\)/admin/audit/ apps/web/app/\(admin\)/admin/page.tsx apps/web/app/\(admin\)/admin/bias-monitor/
git commit -m "$(cat <<'EOF'
feat(web): live updates for admin audit feed and bias monitor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Polish

### Task 19: Admin connection-status indicator

**Files:**

- Create: `apps/web/components/admin/connection-status-indicator.tsx`
- Modify: `apps/web/components/layout/portal-sidebar.tsx`

- [ ] **Step 1: Create the indicator**

Create `apps/web/components/admin/connection-status-indicator.tsx`:

```tsx
"use client";

import { useSocket } from "@/components/providers/socket-provider";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Live",
  disconnected: "Offline",
  unauthorized: "Unauthorized",
} as const;

const STATUS_DOT = {
  idle: "bg-muted",
  connecting: "bg-amber-500 animate-pulse",
  connected: "bg-emerald-500",
  disconnected: "bg-red-500",
  unauthorized: "bg-red-500",
} as const;

export function ConnectionStatusIndicator() {
  const { status } = useSocket();
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-foreground/80"
      role="status"
      aria-live="polite"
    >
      <span
        className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
```

(Color tokens reference Tailwind utility classes — adjust to match the project's design tokens if `bg-emerald-500` is not in the palette. Per `DESIGN.md`, `colors.score-high` (#10b981) is `emerald-500`-equivalent for "connected" semantics.)

- [ ] **Step 2: Render in `portal-sidebar.tsx` for admins only**

Read `apps/web/components/layout/portal-sidebar.tsx`. Find the bottom section (where the user dropdown lives, per `page-inventory.md`). Add the indicator above or beside the user block, gated by role:

```tsx
import { ConnectionStatusIndicator } from "@/components/admin/connection-status-indicator";

// inside the sidebar component, where role is available:
{
  user.role === "admin" ? <ConnectionStatusIndicator /> : null;
}
```

If the sidebar does not currently know the user's role at render, retrieve it via the same hook the rest of the file uses (or add a prop). Do not introduce a new global hook just for this.

- [ ] **Step 3: Type-check**

Run:

```bash
pnpm --filter @aurahire/web type-check
```

Expected: pass.

- [ ] **Step 4: Lint**

Run:

```bash
pnpm --filter @aurahire/web lint
```

Expected: pass.

- [ ] **Step 5: Build**

Run:

```bash
pnpm --filter @aurahire/web build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/connection-status-indicator.tsx apps/web/components/layout/portal-sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(web): add admin-only connection status indicator in sidebar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Full verification

### Task 20: End-to-end manual smoke + failure-mode rehearsal

**Files:** none (verification only).

This task does not create or modify code. It is a checklist the human runs after Phase 5 to confirm all surfaces and failure modes work together. The agent's job is to surface this checklist clearly and stop.

- [ ] **Step 1: Final type-check + lint + build across both apps**

Run:

```bash
pnpm --filter @aurahire/api type-check && pnpm --filter @aurahire/api lint && pnpm --filter @aurahire/api build
```

Expected: all three pass.

Run:

```bash
pnpm --filter @aurahire/web type-check && pnpm --filter @aurahire/web lint && pnpm --filter @aurahire/web build
```

Expected: all three pass.

- [ ] **Step 2: Stop and ask the human to run the manual smoke**

> **Human action required:** with `pnpm dev` running and Mailpit + Redis containers up, run through the full checklist below. Mark each item ✅ or ❌; paste any failure output.
>
> **Connection / handshake:**
>
> - [ ] Recruiter sign-in opens a `/socket.io` WS, API logs `WS connect` with `role=recruiter` and 2 joined rooms.
> - [ ] Candidate sign-in: same with `role=candidate` and 1 joined room.
> - [ ] Admin sign-in: same with `role=admin` and 2 joined rooms.
> - [ ] Sign-out closes the socket cleanly (API logs `WS disconnect`).
>
> **Surface 1 — recruiter pipeline:**
>
> - [ ] New application (candidate submits) appears in recruiter `/recruiter/jobs/<id>` Applications tab without manual refresh, within ~2s.
> - [ ] Recruiter dashboard widgets reflect the new event.
>
> **Surface 2 — candidate status:**
>
> - [ ] Status change Applied→Screening propagates from recruiter window to candidate window.
> - [ ] Screening→Interview, Interview→Offer also propagate.
> - [ ] Schedule interview from recruiter; new row appears in candidate `/candidate/interviews`.
> - [ ] Send offer from recruiter; offer surfaces in candidate application detail.
>
> **Surface 3 — admin audit + bias:**
>
> - [ ] Recruiter publishing a job prepends the audit row in admin `/admin/audit` within ~2s.
> - [ ] Bias-flag override increments admin bias-monitor counts without refresh.
>
> **Failure modes:**
>
> - [ ] Disable Wi-Fi for 10s in candidate window. Reconnect. Status chip changes color while disconnected and recovers to "Live" (admin window) when back.
> - [ ] Change a status during the disconnect window. After reconnect, the candidate's view picks up the change (defense-in-depth invalidate-on-reconnect).
> - [ ] Stop the Redis container (`docker compose stop redis`). Confirm:
>   - The API stays up.
>   - Real-time still works in single-instance dev (in-memory adapter fallback).
>   - REST still works.
>   - Bring Redis back up; subsequent connections wire the Redis adapter again (API log).
> - [ ] Background a candidate browser tab on mobile (or simulate by pausing the tab in devtools) for >30s. On foreground, the socket reconnects and missed events are picked up via invalidate-on-reconnect.
> - [ ] Suspend a logged-in user via admin. The user's existing socket continues until reconnect, then is rejected at handshake (API log: `WS handshake rejected`). Acceptable per spec.
>
> **Cross-browser:**
>
> - [ ] Chrome, Safari, Firefox all connect and receive at least one event.

- [ ] **Step 3: Final commit (if any small fixes were needed)**

If smoke uncovered minor fixes, commit them with focused messages:

```bash
git add <changed paths>
git commit -m "$(cat <<'EOF'
fix(realtime): <one-line description of what was fixed>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If smoke passes cleanly, no extra commit is needed — the feature is complete.

---

## Self-Review Notes (already applied)

- **Spec coverage:** All six events from the spec's event taxonomy are emitted (Phase 2) and listened for on at least one surface (Phase 4). All four room types are joined or used. The three tier-1 surfaces each have a dedicated task. The admin connection-status indicator (Phase 5) is the only spec-described "polish" item; non-tier-1 candidate-side score updates are explicitly excluded per the spec.
- **No placeholders:** every code step contains the actual code; every `pnpm` command shows the exact filter; no "TBD" / "TODO" / "similar to above" anywhere. Where a method or column name is genuinely unverified (e.g., the bias-flag method, the exact recruiter-applications query key inside one client component), the step explicitly tells the executor to read the file first and substitute — those are not placeholders, they are scoped lookups.
- **Type consistency:** `EventsService` method names match the same casing used in the spec event taxonomy; `Rooms.user/recruiter/job/roleAdmin` builders are referenced consistently in the gateway and `EventsService`; `RealtimeEvent.*` constants are the only event-name source on both sides; `useRealtimeChannel` / `useRealtimeRoom` signatures match their callers in Phase 4.
- **Hard-rules compliance:** no step asks the agent to start a dev server, run a Docker command, push to a remote, run a migration, or use destructive git. Every "stop and ask the human" is a human-run command. Constructive git is per-task with `git add <specific paths>` and HEREDOC commit messages.
