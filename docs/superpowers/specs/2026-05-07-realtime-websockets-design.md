# Real-time WebSockets — Design

**Date:** 2026-05-07
**Author:** brainstormed with Claude Code
**Status:** Approved (pending implementation plan)
**Scope:** `apps/api` (new gateway + events module) and `apps/web` (new socket provider + hooks); zero schema changes; reuses existing Redis (BullMQ) and existing JWT validation logic.

## Problem

Today the system has no live channel between server and client. Every screen relies on TanStack Query's `staleTime`/refetch behavior, which means:

- A recruiter on `/recruiter/jobs/[id]` doesn't see new applications stream in — they need a manual refresh or a focus-blur cycle to refetch.
- A candidate on `/candidate/applications/[id]` doesn't see their status change when a recruiter moves them through the pipeline.
- An admin on `/admin/audit` sees a snapshot of audit events frozen at page-load time; the most thesis-defensible "system shows its work" surface is silent.

The user has previously had reliability problems with **Supabase Realtime** (reconnect storms, RLS-per-row broadcast latency, equality-only filters, JWT refresh fragility on long-lived connections). The chosen mechanism is therefore **Socket.io via `@nestjs/websockets`**, terminated on the existing Railway NestJS instance and (when scaled out) backed by the existing Redis used for BullMQ.

## Goals

1. Three high-value real-time surfaces work end-to-end: **application pipeline (recruiter view)**, **candidate application status**, and **admin audit feed**. Each demonstrates a distinct event-flow shape (one-to-many, one-to-one, append-only feed).
2. Backend stays the single source of truth for **all** mutations and **all** event emissions. The frontend never subscribes to raw DB changes — only to semantic application-domain events emitted by the same service that wrote to the DB.
3. The auth model on WebSockets is **identical** to REST: a Supabase JWT presented in the Socket.io handshake is validated with the same `jose` JWKS verification as `SupabaseAuthGuard`, and the resulting `AuthUser` drives room membership.
4. Real-time updates integrate with TanStack Query, not bypass it: events trigger `queryClient.invalidateQueries` (or surgical `setQueryData` patches) so the existing cache layer remains coherent.
5. The system fails open: if WebSockets disconnect, polling/staleTime still keeps data eventually consistent and no UI is broken.
6. Horizontal scaling is wired from day one via `@socket.io/redis-adapter` against the existing Redis URL — so a future second Railway instance does not require re-architecture.

## Non-goals

- **Chat / direct messaging.** Candidate-recruiter chat is explicitly deferred per `page-inventory.md` "Known Gaps."
- **Presence indicators.** No "recruiter is viewing this candidate" or "online now" badges.
- **Typing indicators.**
- **Push notifications / browser notifications / mobile push.** Toast + email coverage already exist via the toast spec.
- **A notifications inbox screen.** Out of sprint per `page-inventory.md`.
- **Batch-progress streaming.** Admin "Apply config to existing" still polls; not in scope here.
- **Real-time bias-check feedback while typing in the JD editor.** The current sync OpenAI request on blur is fine.
- **Real-time AI scoring progress.** Resume parse + score remain `ai-shimmer` synchronous flows from the user's perspective.
- **Server-Sent Events (SSE) fallback.** Socket.io's built-in long-polling fallback is sufficient.
- **Per-event audit logging of WebSocket emissions.** The DB-write that triggers the emission already writes `audit_logs` via the existing audit service. Don't double-log the broadcast.
- **Schema changes.** No migration in this spec.
- **Frontend-side toast surfacing of server-pushed events.** Per the toast spec's "Scope rules": toasts fire only on user-initiated actions in this session. Events from other actors update the cache silently; the user sees the new state, not a notification.

## Tech additions

| Package | Where | Why |
|---|---|---|
| `@nestjs/websockets` | `apps/api` | NestJS gateway abstraction |
| `@nestjs/platform-socket.io` | `apps/api` | Socket.io adapter for NestJS gateway |
| `socket.io` | `apps/api` (transitive) | Server library |
| `@socket.io/redis-adapter` | `apps/api` | Multi-instance pub/sub via existing Redis |
| `socket.io-client` | `apps/web` | Browser client |

Existing dependencies that stay unchanged: `ioredis` (already at 5.10.1, used by `cache/redis.provider.ts` and BullMQ — same client we'll wire into the Redis adapter), `jose` (already at 6.2.3, used by `SupabaseAuthGuard` — reused for WS handshake JWT verification), `@tanstack/react-query` (events trigger `invalidateQueries` on existing keys defined in `apps/web/lib/query/keys.ts`).

## Architecture

### Backend: `apps/api/src/realtime/`

A new project-local module mirroring the shape of `apps/api/src/cache/` (which is the closest precedent — a cross-cutting infra module that other modules inject).

```
apps/api/src/realtime/
├── realtime.module.ts          # @Global() module exporting EventsService
├── realtime.gateway.ts         # @WebSocketGateway, handles connection + room join
├── events.service.ts           # The injectable other services use to emit
├── ws-auth.guard.ts            # @SubscribeMessage guard (JWT validation, mirrors SupabaseAuthGuard)
├── ws-jwt.util.ts              # Extracted jose JWKS verifier (shared with SupabaseAuthGuard via refactor)
├── room.constants.ts           # Room key builders + event name constants
├── redis-adapter.provider.ts   # Pub/sub Redis clients for @socket.io/redis-adapter
└── index.ts                    # Barrel export
```

#### `RealtimeGateway` responsibilities

- `@WebSocketGateway({ cors: { origin: WEB_ORIGIN, credentials: true }, path: '/socket.io', transports: ['websocket', 'polling'] })`
- `handleConnection(client)`:
  1. Read JWT from `client.handshake.auth.token` (set by client at connect time).
  2. Verify via `WsJwtUtil.verify(token)` — same JWKS, same issuer, same audience as `SupabaseAuthGuard`.
  3. Look up profile (`id`, `role`, `status`) from `profilesTable`. Reject if `suspended` or `deleted`.
  4. Attach `client.data.user: AuthUser`.
  5. Auto-join the user-scoped rooms based on role:
     - All authenticated users → `user:{userId}`
     - Recruiters → `recruiter:{userId}` (their own dashboard feed)
     - Admins → `role:admin` (audit log + bias monitor feed)
  6. Emit `connected` ack with `{ userId, role, joinedRooms }` for diagnostic visibility.
- `handleDisconnect(client)`: log only. Socket.io handles room cleanup automatically.
- `@SubscribeMessage('subscribe')` — explicit room join for **resource-scoped** rooms (job rooms): client sends `{ resource: 'job', id: '<uuid>' }`; gateway validates the requesting user has access to that resource (recruiter owns job, or admin role) before `client.join('job:<id>')`. Same RBAC rules already encoded in `RolesGuard` + repository `where` clauses on REST.
- `@SubscribeMessage('unsubscribe')` — leave a room (client sends same shape).

#### `EventsService` API

The injectable that mutating services call after a successful DB write. Single source of truth for the event taxonomy.

```ts
@Injectable()
export class EventsService {
  constructor(@Inject(forwardRef(() => RealtimeGateway)) private gateway: RealtimeGateway) {}

  emitApplicationCreated(payload: ApplicationCreatedPayload): void;
  emitApplicationStatusChanged(payload: ApplicationStatusChangedPayload): void;
  emitInterviewScheduled(payload: InterviewScheduledPayload): void;
  emitOfferSent(payload: OfferSentPayload): void;
  emitAuditEntry(payload: AuditEntryPayload): void;
  emitBiasFlagCreated(payload: BiasFlagCreatedPayload): void;
}
```

Each method:
- Computes the target rooms from the payload (e.g., `application.created` goes to `recruiter:{recruiterId}` AND `job:{jobId}`).
- Calls `this.gateway.server.to(rooms).emit(eventName, payload)`.
- Catches any error and logs via pino at `warn` level — emission failures **never** propagate to the caller. The DB write already succeeded; a missed broadcast degrades to "user refreshes to see it" and that is acceptable.
- Optionally fires from a `setImmediate` so the controller response is not blocked by socket I/O.

#### Auth refactor (small)

Currently `SupabaseAuthGuard` inlines its `jose` JWKS verifier. Extract the verify function (input: token; output: `payload | throws`) into a shared util at `apps/api/src/common/auth/verify-supabase-jwt.ts`, used by both `SupabaseAuthGuard` and `WsJwtUtil`. This is a refactor, not a behavior change.

#### Module wiring

- `RealtimeModule` is `@Global()` so any feature module can inject `EventsService` without importing the module.
- `app.module.ts` registers `RealtimeModule` once. The Redis adapter provider creates **two** ioredis pub/sub clients (Socket.io's adapter requires distinct connections from the cache client; same `REDIS_URL`).
- `main.ts` calls `app.useWebSocketAdapter(new IoAdapter(app))` and passes the Redis adapter into the Socket.io server inside `afterInit`.

#### Service integration points

Each integration point is a single `eventsService.emit*` line added **after** the DB-write commits — never before. Pattern matches the existing `audit.service.ts` invocation pattern in these files.

| File | After which write | Event | Rooms |
|---|---|---|---|
| `apps/api/src/modules/applications/applications.service.ts` `create()` | Application row insert | `application.created` | `recruiter:{recruiterId}`, `job:{jobId}` |
| `apps/api/src/modules/applications/applications.service.ts` `updateStatus()` (line 475) | Status update + state-machine transition | `application.status_changed` | `user:{candidateId}`, `recruiter:{recruiterId}`, `job:{jobId}` |
| `apps/api/src/modules/applications/applications.service.ts` `withdraw()` if present | Status update | `application.status_changed` (status=`withdrawn`) | same as above |
| `apps/api/src/modules/interviews/interviews.service.ts` `schedule()` | Interview row insert | `interview.scheduled` | `user:{candidateId}`, `recruiter:{recruiterId}` |
| `apps/api/src/modules/offers/offers.service.ts` `send()` | Offer row insert | `offer.sent` | `user:{candidateId}`, `recruiter:{recruiterId}` |
| `apps/api/src/audit/audit.service.ts` `record()` | Audit row insert | `audit.entry` | `role:admin` |
| `apps/api/src/modules/bias/bias.service.ts` (whichever method records a flag) | Flag row insert | `bias.flag_created` | `role:admin` |

Note: candidate-side score updates (rescore on resume change) are **not** in this list. Profile rescore is a single-user operation; the user's own UI already shows the AI shimmer + result. No second observer needs the event.

### Frontend: `apps/web/lib/realtime/` + `apps/web/components/providers/socket-provider.tsx`

```
apps/web/lib/realtime/
├── client.ts                # makeSocket(getToken) — singleton-per-tab socket factory
├── events.ts                # Event-name + payload type definitions (mirrors backend)
├── rooms.ts                 # Helper: subscribeToJob(socket, jobId) → unsubscribe fn
└── index.ts                 # Barrel
```

#### `SocketProvider`

Mounted in `apps/web/app/layout.tsx` **inside** `QueryProvider` and `AuthTokenProvider` (both already exist):

```
<AuthTokenProvider>
  <QueryProvider>
    <SocketProvider>  {/* new */}
      <ConfirmProvider>
        ...
      </ConfirmProvider>
    </SocketProvider>
  </QueryProvider>
</AuthTokenProvider>
```

Responsibilities:
- Lazily constructs the singleton socket on **first authenticated render**. If no Supabase session, no socket.
- Reads the access token from `auth-token-provider` (or directly from `supabase.auth.getSession()`).
- Passes the token via `socket.io-client`'s `auth: { token }` option at handshake.
- Listens for `connect`, `disconnect`, `connect_error` and surfaces an enum status (`connecting | connected | disconnected | unauthorized`) via React context. Most components ignore status; the `<SocketStatusIndicator>` (admin-only, future) can read it.
- On Supabase JWT refresh (`onAuthStateChange` `TOKEN_REFRESHED`): updates the in-memory token and calls `socket.disconnect(); socket.connect();` so the new token is presented at handshake. Reconnection re-joins all rooms via the connection-time auto-joins; resource-scoped rooms re-subscribe via the per-page hook (see below).
- Provides `useSocket()` returning the socket instance (or `null` during initial connect).

#### `useRealtimeChannel(eventName, handler, deps)` hook

A convenience hook used by pages that need to listen for events:

```ts
export function useRealtimeChannel<E extends RealtimeEventName>(
  event: E,
  handler: (payload: RealtimeEventPayload[E]) => void,
): void;
```

Subscribes on mount, unsubscribes on unmount, no race conditions.

#### `useRealtimeRoom(resource, id)` hook

For resource-scoped rooms (jobs):

```ts
export function useRealtimeRoom(resource: 'job', id: string | null): void;
```

On mount: emits `subscribe { resource, id }`. On unmount or `id` change: emits `unsubscribe { resource, id: previous }`. Backend gateway validates access; if rejected, the socket emits `subscribe_error` which the hook logs (no toast — this is a system-level event, not user-initiated).

### Cache integration

Per surface, the event-handler pattern is **always** one of two shapes:

- **Pattern A — Invalidate (default):** call `queryClient.invalidateQueries({ queryKey: keys.applicationsForJob(jobId) })`. Simple, always correct, costs a refetch.
- **Pattern B — Surgical patch:** call `queryClient.setQueryData(keys.application(applicationId), prev => prev ? { ...prev, status: payload.status } : prev)`. Avoids the refetch, but only safe when the event payload contains all the fields the cached entity needs.

Spec rule: **start with Pattern A everywhere.** Pattern B is a future optimization, applied only after measuring refetch cost. Mixing the two without rigor leads to stale-state bugs.

## Event taxonomy

Each event has: name (string constant), payload (typed in `apps/web/lib/realtime/events.ts` and re-exported from `packages/shared/src/realtime/` for backend reuse), emitting service, target rooms, frontend cache action.

| Event | Payload (key fields) | Emitted by | Rooms | Frontend action |
|---|---|---|---|---|
| `application.created` | `applicationId`, `jobId`, `recruiterId`, `candidateId`, `createdAt` | `applications.service.create()` | `recruiter:{recruiterId}`, `job:{jobId}` | Invalidate `applicationsForJob(jobId)`, `recruiterStats`, `recruiterRecent` |
| `application.status_changed` | `applicationId`, `jobId`, `recruiterId`, `candidateId`, `previousStatus`, `status`, `changedAt` | `applications.service.updateStatus()` | `user:{candidateId}`, `recruiter:{recruiterId}`, `job:{jobId}` | Invalidate `application(applicationId)`, `myApplications` (candidate side), `applicationsForJob(jobId)` (recruiter side) |
| `interview.scheduled` | `interviewId`, `applicationId`, `jobId`, `recruiterId`, `candidateId`, `scheduledFor`, `format` | `interviews.service.schedule()` | `user:{candidateId}`, `recruiter:{recruiterId}` | Invalidate `myInterviews`, `recruiterInterviews` |
| `offer.sent` | `offerId`, `applicationId`, `recruiterId`, `candidateId`, `sentAt` | `offers.service.send()` | `user:{candidateId}`, `recruiter:{recruiterId}` | Invalidate `application(applicationId)`, `myApplications` |
| `audit.entry` | `auditId`, `actorId`, `action`, `entityType`, `entityId`, `createdAt`, `summary` | `audit.service.record()` | `role:admin` | Prepend to admin audit-log query cache (Pattern B exception — append-only feed); fall back to invalidate if cache shape doesn't match |
| `bias.flag_created` | `flagId`, `jobId`, `term`, `category`, `createdAt` | `bias.service.<method>` | `role:admin` | Invalidate `biasMonitor`, `adminDashboardStats` |

**Event name discipline:** dotted-namespace, past-tense verb (`<entity>.<verb_past>`). No `update`, no `change` — names describe what happened, not what to do.

## Room model

| Room | Members | Joined when | Purpose |
|---|---|---|---|
| `user:{userId}` | The user themselves (any role) | On connect | Personal events (status of my application, my interview scheduled, my offer received) |
| `recruiter:{recruiterId}` | The recruiter themselves | On connect, if `role === 'recruiter'` | Recruiter dashboard aggregate feed |
| `job:{jobId}` | Recruiter who owns the job + admins | On `subscribe` from a job-detail page | New applications, status changes for that specific job |
| `role:admin` | All admin users | On connect, if `role === 'admin'` | Audit feed, bias-flag feed |

Multi-tenancy note: AuraHire has companies, but at the event level, room membership is keyed by **user**, not company. The user's role + ownership chain (recruiter owns job → recruiter is in `job:{jobId}`) handles tenancy implicitly. We do not introduce `company:{id}` rooms in this spec — they are not needed by any tier-1 surface and would require deciding company-wide broadcast policy.

## Surface-by-surface inventory

### Surface 1 — Recruiter pipeline live updates

**Pages:**
- `apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx` (Applications tab)
- `apps/web/app/(recruiter)/recruiter/page.tsx` (dashboard pipeline funnel + Top Candidates + Recent Activity widgets)

**Behavior:**
- Job detail page: on mount, `useRealtimeRoom('job', jobId)` joins `job:{jobId}`. Listens for `application.created` and `application.status_changed`; invalidates the applications-for-job query on either.
- Recruiter dashboard: relies on auto-joined `recruiter:{recruiterId}` room. Listens for `application.created`, `application.status_changed`, `bias.flag_created` (recruiter sees their own jobs' flags); invalidates `recruiterStats`, `recruiterRecent`, `recruiterAnalytics` queries.

**UX:** new applications appear in the table without any visual fanfare — the table just updates. No toast (per scope rule). Optionally, a subtle "1 new application" highlight on the row for 2s on first render after invalidation; this is a polish item, not a spec requirement.

### Surface 2 — Candidate application status live updates

**Pages:**
- `apps/web/app/(candidate)/candidate/applications/page.tsx`
- `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx`
- `apps/web/app/(candidate)/candidate/interviews/page.tsx`

**Behavior:**
- All candidate portal pages benefit from the auto-joined `user:{userId}` room.
- Listens for `application.status_changed`, `interview.scheduled`, `offer.sent`; invalidates the corresponding queries.
- No toast on status change (a recruiter changing status is an external action, per toast scope rules). The status chip silently changes color and label; the timeline tab gets a new entry; the offer tab appears if `offer.sent` arrived.

**Why this is the thesis-defense moment:** in a demo, two browser windows side-by-side. Recruiter drags the candidate from Screening → Interview. Candidate window: chip changes from amber "Screening" to blue "Interview", timeline gets a new dot, all without refresh. This is the most narratively powerful real-time moment in the system.

### Surface 3 — Admin audit feed

**Pages:**
- `apps/web/app/(admin)/admin/audit/page.tsx`
- `apps/web/app/(admin)/admin/page.tsx` (Recent Audit Events widget)
- `apps/web/app/(admin)/admin/bias-monitor/page.tsx`

**Behavior:**
- All admin pages benefit from auto-joined `role:admin` room.
- Audit page: listens for `audit.entry`. Pattern B exception: prepends the entry to the cached audit-log array so the user sees the row appear at the top of the table. (Filter coherence note: if the user has filters applied that exclude this entry, prepending creates a row that doesn't match the filter. Mitigation: re-evaluate filter client-side on insert; if it doesn't match, drop. Implementation can start with Pattern A — invalidate — and migrate to B only if perf demands it.)
- Bias monitor: listens for `bias.flag_created`; invalidates the bias-monitor query and the admin dashboard stats.

**UX:** new audit row slides in (CSS `animate-in slide-in-from-top` 180ms). The "live" feel of an append-only log is the demo signal. Add a small `chip-status-info` "LIVE" badge in the top-right of the audit page header that pulses when connected.

## Connection lifecycle

### Connect

1. `SocketProvider` mounts with a Supabase session present.
2. `socket.io-client` opens connection to `wss://api.aurahire.app/socket.io` (or `ws://localhost:3333/socket.io` in dev) with `auth: { token: <jwt> }`.
3. Backend `RealtimeGateway.handleConnection`:
   - Verifies JWT.
   - Loads profile.
   - Auto-joins user-scoped rooms.
   - Emits `connected` ack.
4. Frontend transitions context status `connecting → connected`.

### Subscribe to resource room

1. Page using `useRealtimeRoom('job', jobId)` mounts.
2. Hook emits `subscribe { resource: 'job', id: jobId }`.
3. Backend validates: `recruiterOwnsJob(userId, jobId) || role === 'admin'`. If yes, `client.join('job:<id>')` and emits `subscribed { resource, id }`. If no, emits `subscribe_error { resource, id, reason: 'forbidden' }`.
4. On unmount or `jobId` change, hook emits `unsubscribe { resource: 'job', id: previousId }`.

### Disconnect / reconnect

- Network blip: Socket.io client auto-reconnects with exponential backoff (defaults: 1s, 2s, 4s, max 5s, infinite retries — sufficient for sprint).
- On reconnect: gateway re-runs `handleConnection`, JWT is re-validated, user-scoped rooms re-joined.
- Resource-scoped rooms: each page using `useRealtimeRoom` automatically re-emits `subscribe` on socket-`connect` event (re-subscription is idempotent on the server).
- **Missed-events policy:** during disconnect window, events may have been emitted that the client missed. On `connect` (post-reconnect), the `useRealtimeChannel` consumer also calls `queryClient.invalidateQueries` for the relevant keys it cares about — defense in depth. This is a per-page concern, documented in the implementation plan.

### JWT refresh mid-session

- Supabase access tokens last 1 hour by default. On `TOKEN_REFRESHED`, `SocketProvider` updates the in-memory token and calls `socket.disconnect(); socket.connect();`. The new handshake presents the fresh token.
- During the (sub-second) gap, no events are received — same defense as above (invalidate on reconnect).
- If the refresh fails (refresh token expired), the auth provider routes the user to `/login` — Socket.io disconnects, no special handling needed.

### Sign-out

- User clicks Sign Out → Supabase session cleared → `SocketProvider` calls `socket.disconnect()` → server logs disconnect.

## Security & RBAC

- **Handshake authentication is mandatory.** No anonymous connections, no public events. The marketing site (logged-out) doesn't open a socket.
- **Suspended/deleted users are rejected at handshake**, same as REST.
- **Resource-scoped subscribe is RBAC-checked**. The check uses the **same** repository methods that REST controllers use to verify ownership — no parallel logic. This means a recruiter cannot subscribe to another recruiter's job, even if they know the UUID.
- **No RLS-layer enforcement of WS payloads.** Postgres RLS protects DB reads. WS broadcasts a payload that the backend already constructed using server-trusted data; the payload reaches a client only if that client is in the room, and room membership is RBAC-controlled. There is no path where a payload constructed for room A leaks to room B.
- **Audit-feed sensitivity.** `audit.entry` events go to `role:admin` only. The payload contains `summary` (free-text) and IDs — no PII beyond what admins can already see in the audit table.
- **Rate limiting.** `@nestjs/throttler` already protects REST. For WS we apply a simple in-memory limit per connection: max 30 `subscribe`/`unsubscribe` messages per minute per socket. Any client exceeding this is disconnected with code `RATE_LIMITED`. Emissions from server → client are not rate-limited (server-trusted).
- **CORS.** Origin restricted to `WEB_ORIGIN` env (mirrors REST CORS config in `main.ts`). Credentials enabled (cookies are not used for WS auth, but consistency with REST is maintained).

## Failure modes & graceful degradation

| Failure | System behavior | UX impact |
|---|---|---|
| Redis adapter unreachable on boot | Gateway logs error, falls back to single-instance broadcast (no adapter). Single Railway instance still works. | None during sprint (one instance). |
| Redis goes down mid-session | Adapter buffers/drops; events emitted on instance A may not reach instance B. With one instance, no impact. With multiple, brief inconsistency. | TanStack Query staleTime / refetch on focus catches the drift. |
| Client cannot connect (firewall, corp proxy) | Socket.io falls back to long-polling automatically (declared in transports). | If polling also fails, status indicator shows `disconnected`; data is fetched via REST as before. **Nothing breaks.** |
| Server emits but client missed it (briefly disconnected) | No retry. | Defense in depth: `useRealtimeChannel` consumers invalidate on reconnect. |
| JWT expired during long idle session | Server rejects on next handshake. Auth provider triggers refresh on `TOKEN_REFRESHED`; socket reconnects. | Sub-second gap. |
| Suspended user with active socket | Their next handshake is rejected. Mid-session admin suspension does not auto-disconnect them — accepted limitation; their next REST call is also still permitted until the next request. (Sprint-acceptable.) | Worst case: ~1h of continued access before token refresh. Same exposure as REST. |
| User exceeds subscribe rate limit | Disconnected. Client re-connects automatically. | Self-corrects; no UX change unless they're actively flooding. |
| Multi-tab same user | Each tab opens its own socket; both join `user:{userId}`. Events arrive in both. | Both tabs update simultaneously. Expected. |

## Files affected

**Backend — 13 new + 8 modified.**

### New (backend)
- `apps/api/src/realtime/realtime.module.ts`
- `apps/api/src/realtime/realtime.gateway.ts`
- `apps/api/src/realtime/events.service.ts`
- `apps/api/src/realtime/ws-auth.guard.ts`
- `apps/api/src/realtime/ws-jwt.util.ts`
- `apps/api/src/realtime/room.constants.ts`
- `apps/api/src/realtime/redis-adapter.provider.ts`
- `apps/api/src/realtime/index.ts`
- `apps/api/src/common/auth/verify-supabase-jwt.ts` (extracted from `SupabaseAuthGuard`)
- `packages/shared/src/realtime/events.ts` (typed event names + payload schemas, Zod-derived)
- `packages/shared/src/realtime/index.ts` (barrel)

### Modified (backend)
- `apps/api/src/common/guards/supabase-auth.guard.ts` — replace inline JWT verify with `verify-supabase-jwt.ts` util
- `apps/api/src/app.module.ts` — register `RealtimeModule` (global)
- `apps/api/src/main.ts` — `app.useWebSocketAdapter(new IoAdapter(app))` + Redis adapter wiring
- `apps/api/src/modules/applications/applications.service.ts` — emit `application.created`, `application.status_changed`
- `apps/api/src/modules/interviews/interviews.service.ts` — emit `interview.scheduled`
- `apps/api/src/modules/offers/offers.service.ts` — emit `offer.sent`
- `apps/api/src/audit/audit.service.ts` — emit `audit.entry` after `record()`
- `apps/api/src/modules/bias/bias.service.ts` — emit `bias.flag_created` after flag insert (if such a method exists; confirm during plan)
- `apps/api/package.json` — add `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@socket.io/redis-adapter`

**Frontend — 5 new + 8 modified.**

### New (frontend)
- `apps/web/components/providers/socket-provider.tsx`
- `apps/web/lib/realtime/client.ts`
- `apps/web/lib/realtime/events.ts` (re-exports from `@aurahire/shared/realtime`)
- `apps/web/lib/realtime/rooms.ts`
- `apps/web/lib/realtime/index.ts`
- `apps/web/hooks/use-realtime-channel.ts`
- `apps/web/hooks/use-realtime-room.ts`

### Modified (frontend)
- `apps/web/app/layout.tsx` — mount `<SocketProvider>` inside `QueryProvider`
- `apps/web/app/(recruiter)/recruiter/jobs/[id]/page.tsx` and its applications-tab client component — add `useRealtimeRoom('job', id)` + `useRealtimeChannel` for `application.*`
- `apps/web/app/(recruiter)/recruiter/_dashboard-client.tsx` — add `useRealtimeChannel` for recruiter feed events
- `apps/web/app/(candidate)/candidate/applications/[id]/page.tsx` and its client component — add `useRealtimeChannel` for `application.status_changed`, `interview.scheduled`, `offer.sent`
- `apps/web/app/(candidate)/candidate/applications/page.tsx` client list — same
- `apps/web/app/(candidate)/candidate/interviews/page.tsx` client list — `interview.scheduled`
- `apps/web/app/(admin)/admin/audit/page.tsx` client component — `audit.entry`
- `apps/web/app/(admin)/admin/page.tsx` Recent Audit Events widget client — `audit.entry`
- `apps/web/app/(admin)/admin/bias-monitor/page.tsx` client — `bias.flag_created`
- `apps/web/package.json` — add `socket.io-client`

### Not changing
- Database schema. No migration.
- Drizzle queries. No new repository methods.
- Existing REST endpoints. No new endpoints.
- BullMQ workers. No new jobs.
- Toast helpers. WS events are scoped out of toast surfacing per the toast spec.
- `next.config.ts` / Vercel config. Vercel is a passthrough; the WS connection terminates on Railway, not Vercel.
- Any AI service. Real-time scoring progress is a non-goal.

## Configuration

New environment variables: **none**. Reuses:
- `WEB_ORIGIN` (already used for REST CORS)
- `REDIS_URL` (already used by cache + BullMQ)
- `SUPABASE_URL` (already used by `SupabaseAuthGuard` for JWKS)
- Frontend uses the existing `NEXT_PUBLIC_API_URL` to build the socket URL (`ws(s)://<API_URL_HOST>/socket.io`).

## Edge cases

1. **Self-events.** If a recruiter changes a status, they're in `recruiter:{their-id}` room and receive their own `application.status_changed`. The frontend handler invalidates queries — same as if a teammate did it. The user-initiated mutation already invalidated optimistically; the broadcast invalidation is harmless redundancy.
2. **Candidate viewing their own application detail when recruiter changes status.** Both `user:{candidateId}` (candidate's room) and `recruiter:{recruiterId}` rooms get the event; the candidate's UI updates without a page refresh. This is the marquee demo.
3. **Admin viewing audit log with filters that exclude the new entry.** Pattern A (invalidate) is filter-coherent automatically. If we adopt Pattern B for the audit page, the client-side filter must re-evaluate before prepending. Spec rule: ship Pattern A first.
4. **User logs out in tab A while tab B is connected.** Tab A clears session and disconnects its socket. Tab B still has its session and stays connected — both tabs share Supabase auth via cookies, but tab B's socket connection has its own JWT in memory. On tab B's next JWT refresh, it'll discover the session is gone and disconnect. Sprint-acceptable.
5. **Concurrent status changes from two recruiters on the same job.** Each emits an event; both arrive. The latest cache state is whatever the last `application.status_changed` says. Application state machine on the backend prevents invalid transitions; race winner is whoever committed first.
6. **Frontend handler throws.** Wrap each `useRealtimeChannel` handler invocation in a try/catch inside the hook implementation; log to console. A buggy handler doesn't kill the socket.
7. **High-frequency event burst (e.g., bulk status update on shortlist).** Backend service emits one event per row. With 50 candidates that's 50 events to `recruiter:{id}` plus 50 to `job:{id}` plus 50 to each `user:{candidateId}`. Acceptable; Socket.io handles thousands per second easily. Frontend invalidation is debounced naturally by TanStack Query (multiple invalidations of the same key collapse to one refetch in-flight). If perf becomes an issue, batch into a single `applications.bulk_status_changed` event — out of scope for this spec.
8. **Server-side emit from a queue worker (BullMQ).** All emits in this spec come from request-path service code. If a future BullMQ worker mutates and needs to emit, it injects `EventsService` and calls the same methods — works identically. Out of scope to wire any specific worker now.
9. **Frontend hot-reload in dev.** Socket.io client handles HMR fine; the singleton is recreated on full reload; on partial HMR the existing socket persists. No special handling.
10. **Local dev without Redis adapter.** Single dev instance — adapter not strictly required. Provider wires it only if `REDIS_URL` is set. (It will be set per `env-setup.md`, but the conditional is good defense.)

## Verification plan

No automated test harness for WS in this repo. Verification is manual, run by the human after implementation.

**Pre-flight:**
- `pnpm tsc --noEmit` passes in `apps/api` and `apps/web`.
- `pnpm lint` passes in both.
- `pnpm build` succeeds in both.

**Backend smoke (single browser):**
1. Sign in as a recruiter. Open browser devtools → Network → WS. Confirm `/socket.io` connection upgrades and the `connected` ack fires with the right `joinedRooms`.
2. Sign in as candidate in a different browser (or incognito). Same check — different rooms.
3. Sign in as admin. Confirm `role:admin` in joined rooms.

**Surface 1 — recruiter pipeline:**
- Two windows: recruiter on `/recruiter/jobs/[id]`. Candidate (separate browser) submits an application to that job.
- Recruiter window: new application row appears in the applications table without manual refresh, within ~2s.
- Recruiter dashboard: pipeline funnel count increments; Recent Activity shows the new event.

**Surface 2 — candidate status:**
- Two windows side-by-side: candidate on `/candidate/applications/[id]`, recruiter on `/recruiter/applications/[id]` for the same application.
- Recruiter changes status from Applied → Screening.
- Candidate window: chip color + label updates; timeline tab gets a new entry. No refresh.
- Repeat for Screening → Interview, Interview → Offer.
- Recruiter schedules an interview. Candidate `/candidate/interviews` page (open in third tab): new interview row appears.
- Recruiter sends an offer. Candidate application detail: offer section appears.

**Surface 3 — admin audit:**
- Admin on `/admin/audit`. Recruiter (separate browser) takes any auditable action (publishes a job, changes a status).
- Admin window: new audit row appears at the top of the table within ~2s.
- Admin dashboard "Recent Audit Events" widget: same.
- Recruiter publishes a JD with a flagged term and overrides the bias flag. Admin bias-monitor page: flag count increments without refresh.

**Failure modes:**
- Disconnect Wi-Fi for 10s mid-session. Reconnect. Confirm:
  - Socket auto-reconnects (status indicator transitions disconnected → connected).
  - Any events emitted during the gap are picked up via the on-reconnect invalidation.
- Force JWT refresh (wait 1h, or shrink token TTL temporarily). Confirm socket reconnects with the new token without errors.
- Shut down Redis container (`docker compose stop redis`). Confirm:
  - With one Railway instance, real-time still works locally (adapter optional).
  - REST still works.
  - Bring Redis back up; WS resumes adapter usage on next connection.
- Suspend a logged-in user via admin. They keep their socket until next reconnect, then are rejected. Acceptable.

**Cross-browser:**
- Chrome, Safari, Firefox. Socket.io handles transport differences; no special checks beyond confirming all three connect.

**Mobile:**
- Open candidate portal on phone. Background the tab for 30s (mobile suspends sockets). Foreground. Confirm reconnect + invalidate-on-reconnect behavior fills any gap. (Mobile suspension is the most common real-world disconnect; this is the test that matters.)

## Open questions

1. **Resource-scoped admin subscribe.** Admins are auto-joined to `role:admin`. Should admins also be allowed to subscribe to `job:{id}` rooms when they're inspecting a specific job in `/admin/jobs/[id]` drawer? Recommendation: yes, but only as a follow-up — not tier-1. **Resolved direction:** out of scope for this spec; admins observe via `role:admin` aggregate feed only.
2. **`recruiter:{id}` vs `company:{id}` aggregation.** If a company has multiple recruiters, should they share a feed of all company applications? Recommendation: **no for sprint** — recruiters see only their own jobs' events. Sharing would require company-room logic + RBAC review. **Resolved direction:** keep recruiter-scoped only.
3. **Should the candidate see live `audit.entry` events related to their own data (e.g., admin viewing their resume)?** Recommendation: **no.** Audit transparency is admin-internal; candidate-facing transparency comes through the explainable-AI surfaces, not raw audit events. **Resolved.**
4. **Per-event Pattern B (surgical patch) for high-traffic events.** Audit feed is the strongest candidate. Recommendation: **defer** — ship Pattern A everywhere first, optimize after measuring. **Resolved direction:** Pattern A only in this spec.
5. **Do we want a connection-status indicator visible to all users?** Recommendation: **admin-only** in the admin topbar, hidden for candidate/recruiter. Simpler, less alarming when transient blips happen. **Resolved direction:** admin-only, but ship as polish, not tier-1.

No blocking open questions. Spec is ready for an implementation plan.
