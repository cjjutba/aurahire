# AuraHire Engineering Best Practices

**Version:** 2.0.0 (Split Architecture)
**Last Updated:** May 1, 2026
**Status:** Locked for Sprint
**Audience:** every contributor (human or agent) writing code in this repo

This document is the engineering contract. Violating it makes the system harder to maintain, harder to defend, and harder to demo. Read it before writing code.

> **Architecture context:** AuraHire is a Turborepo monorepo with split frontend (Next.js — `apps/web`) and backend (NestJS — `apps/api`). The frontend is a UI layer; the backend owns all business logic, DB, AI, queues, cron, secrets. Read `architecture.md` before applying patterns from this doc.

---

## Core Principles

### 1. Lean over feature-rich

A bug fix doesn't need surrounding cleanup. A one-shot operation doesn't need a helper. Three similar lines is better than a premature abstraction. **Don't add error handling, fallbacks, or validation for scenarios that can't happen.** Trust internal code and framework guarantees. Validate at boundaries: user input, external APIs, file uploads. Beyond that, assume your own code works.

### 2. Type safety end-to-end

The flow is: **Zod schema (`packages/shared`) → NestJS DTO (via nestjs-zod) → OpenAPI spec → orval-generated TS client → TanStack Query → RHF + JSX**. Every layer typed. Zero `any`. If you reach for `any`, stop and design the type.

### 3. Server-first (Frontend) / Module-first (Backend)

**Frontend (`apps/web`):** Server Components by default. Add `"use client"` only when you need interactivity, browser APIs, or React hooks. If a page can render entirely on the server, it should. Server Components fetch data via the auto-generated API client; mutations use TanStack Query mutation hooks.

**Backend (`apps/api`):** every feature is a NestJS Module — a folder containing `.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `dto/`. Logic lives in services; controllers are thin (HTTP shape only); repositories own DB access via Drizzle.

### 4. Defense in depth

Five layers protect every authenticated request:

- **Layer 1 — Frontend middleware:** redirect unauthenticated users at URL level (`apps/web/middleware.ts`).
- **Layer 2 — Backend CORS + Helmet:** reject cross-origin or malformed requests.
- **Layer 3 — `SupabaseAuthGuard`:** validates JWT at every protected controller.
- **Layer 4 — `RolesGuard` + `OwnershipGuard`:** RBAC + per-resource ownership checks.
- **Layer 5 — Postgres RLS:** database refuses unauthorized reads/writes even if 1–4 are bypassed.

Never rely on a single layer. Never disable RLS. Never trust the client.

### 5. Visible AI

Every AI call has a visible affordance: shimmer with caption, "AI Suggested" badge, evidence callout. **Silent AI is a thesis violation.**

---

## TypeScript

### Configuration

```json
// tsconfig.json — sprint-locked
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noUnusedLocals": false, // false during sprint to allow rapid iteration
    "noUnusedParameters": false
  }
}
```

### Rules

- **No `any`.** Use `unknown` if you genuinely don't know; narrow with type guards.
- **No `as` casts** unless inference can't follow (e.g., `event.target as HTMLInputElement`). Prefer type guards.
- **Discriminated unions over enums.** `type Status = "applied" | "screening" | ...` is more flexible than a TypeScript `enum`.
- **Pull types from the database, not duplicate definitions.** Import `typeof applicationsTable.$inferSelect` rather than redefining shape in app code.
- **Function return types annotated** for exported functions. Inferred return types are fine for local helpers.

---

## Server Components & Client Components (Frontend)

### Default: Server Components

A component is a Server Component unless you explicitly mark it `"use client"`. Server Components:

- Don't ship JS to the browser
- Can call the backend API server-side (using `fetch()` with the user's JWT from cookies)
- Can read environment variables safely (no leaking to client bundle)
- Can be async (`export default async function Page() { ... }`)
- **Cannot import from `apps/api` or `packages/db` directly.** Frontend talks to backend via REST only.

### When to use Client Components

Mark a component `"use client"` if it:

- Uses `useState`, `useEffect`, `useMemo`, `useRef`, or any other React hook
- Listens to user events (`onClick`, `onChange`, etc.)
- Uses browser APIs (`window`, `localStorage`, `fetch` with reactivity)
- Imports a library that itself uses hooks (most form libraries, charts)

### The Composition Pattern

A Server Component can render a Client Component, but a Client Component can only render Server Components passed as `children` props. Use this:

```tsx
// page.tsx — Server Component
export default async function Page() {
  const data = await getApplications();
  return (
    <ClientFilterShell>
      <ApplicationsList items={data} />
    </ClientFilterShell>
  );
}
```

Don't drag the entire data fetch into the client.

---

## NestJS Backend Patterns

The backend (`apps/api`) is the **only** place where mutations happen. The frontend calls REST endpoints; controllers receive validated DTOs; services contain logic; repositories hit the DB.

### Module structure (every feature)

```
apps/api/src/modules/<feature>/
├── <feature>.module.ts        # NestJS module declaration
├── <feature>.controller.ts    # REST endpoints + Swagger decorators
├── <feature>.service.ts       # Business logic
├── <feature>.repository.ts    # Drizzle queries (when DB-heavy)
└── dto/
    ├── create-<feature>.dto.ts
    ├── update-<feature>.dto.ts
    └── <feature>-response.dto.ts
```

### Controller template

```ts
@Controller("applications")
@ApiTags("applications")
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles("candidate")
  @ApiOperation({ summary: "Apply to a job" })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @Body() dto: ApplyToJobDto, // Zod-validated via nestjs-zod
    @CurrentUser() user: AuthUser,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.apply(dto, user);
  }
}
```

### Service template

```ts
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly repo: ApplicationsRepository,
    private readonly scoringService: ScoreMatchService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async apply(
    dto: ApplyToJobDto,
    user: AuthUser,
  ): Promise<ApplicationResponseDto> {
    // 1. Authorization (job published, no duplicate)
    await this.assertEligible(user.id, dto.jobId);

    // 2. Persist application
    const application = await this.repo.create({
      ...dto,
      candidateId: user.id,
    });

    // 3. AI scoring (synchronous, awaited)
    const matchScore = await this.scoringService.score(application.id);

    // 4. Side effects
    await this.emailService.sendApplicationReceived(application);
    await this.auditService.log({
      actorId: user.id,
      actorType: "user",
      action: "application.created",
      entityType: "application",
      entityId: application.id,
    });

    // 5. Cache invalidation
    await this.cache.del(`recruiter:applications:${application.recruiterId}`);

    // 6. Return DTO
    return ApplicationMapper.toResponse(application, matchScore);
  }
}
```

### Backend rules

- **Controllers are thin.** Handle HTTP shape (decorators, DTOs, response types) — delegate logic to services.
- **Services own logic.** Composable, testable, framework-aware (DI), do NOT touch HTTP request/response objects.
- **Repositories own DB access.** Use Drizzle queries; return domain objects, not raw rows.
- **DTOs validate via Zod (nestjs-zod).** Schema lives in `packages/shared/`.
- **Always include `SupabaseAuthGuard` + `RolesGuard`** on protected controllers; use `@Public()` to opt out only for auth bootstrap endpoints.
- **Always log to audit** for consequential mutations.
- **Always invalidate cache** for mutations that affect cached responses.
- **Always include Swagger decorators** for documentation generation.
- **Never throw raw Postgres errors.** Map via exception filter to standard error envelope.

---

## Frontend Mutation Patterns

The frontend uses TanStack Query mutation hooks (auto-generated from OpenAPI by orval) to call backend endpoints.

```tsx
// In a Client Component
"use client";
import { useApplyToJob } from "@aurahire/shared";

export function ApplyButton({ jobId, resumeId }: Props) {
  const router = useRouter();
  const applyToJob = useApplyToJob({
    onSuccess: (data) => {
      toast.success("Application submitted");
      router.push(`/candidate/applications/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button
      disabled={applyToJob.isPending}
      onClick={() => applyToJob.mutate({ jobId, resumeId })}
    >
      {applyToJob.isPending ? "Submitting..." : "Apply"}
    </Button>
  );
}
```

### Frontend rules

- **No imports from `apps/api/`** — ever.
- **No imports from `packages/db/`** — except types in rare cases (most types come through Zod).
- **No direct OpenAI / Supabase Storage / DB calls.** All data goes through backend REST.
- **Form schemas come from `packages/shared/`** — never inline.
- **Forms use RHF + Zod resolver** with the shared schema.
- **Every async operation has loading + error states.**

---

## Validation with Zod

### Single source of truth

Every form has one Zod schema in `lib/validation/<feature>.ts`. The schema is imported by:

1. The client form (RHF resolver)
2. The Server Action (parse input)
3. (Optionally) the Drizzle insert/select shape via `drizzle-zod`

Don't define a TypeScript type for form data — `z.infer<typeof schema>` gives it to you.

### Schema discipline

```ts
// lib/validation/auth.ts
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(100);

export const registerCandidateSchema = z
  .object({
    fullName: z.string().min(2).max(100),
    email: z.string().email().toLowerCase(),
    phone: z.string().regex(/^[\d\s+()-]{7,20}$/, "Invalid phone format"),
    password: passwordSchema,
    confirmPassword: z.string(),
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: "You must agree to the terms" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterCandidateInput = z.infer<typeof registerCandidateSchema>;
```

- **Compose, don't duplicate.** Reusable atoms (`emailSchema`, `passwordSchema`, `phoneSchema`) live in `lib/validation/shared.ts`.
- **Custom error messages.** Default Zod messages are not user-friendly. Always provide a message.
- **Refinements over post-parse logic.** Cross-field validation (e.g., password match) belongs in `.refine()`.
- **Coerce when reasonable.** `z.string().toLowerCase()` for emails. `z.coerce.number()` for query params.

---

## Forms (React Hook Form + Zod + shadcn)

### Form template

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  registerCandidateSchema,
  type RegisterCandidateInput,
} from "@/lib/validation/auth";
import { registerCandidate } from "@/lib/server-actions/auth/register-candidate";

export function RegisterCandidateForm() {
  const form = useForm<RegisterCandidateInput>({
    resolver: zodResolver(registerCandidateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      agreedToTerms: false,
    },
  });

  async function onSubmit(values: RegisterCandidateInput) {
    const result = await registerCandidate(values);
    if (!result.success) {
      form.setError("root", { message: result.error });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* ... */}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting
            ? "Creating account..."
            : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
```

### Form rules

- **One schema per form.** Imported from `lib/validation/`.
- **Inline `defaultValues`** to avoid undefined → controlled input warnings.
- **Disable submit during submission.** `form.formState.isSubmitting`.
- **Show validation errors inline** with `<FormMessage />`.
- **Show submission errors at form level** via `form.setError("root", ...)`.
- **Server Action handles success redirects** (via `redirect()`); the client form just awaits the result.

---

## Database Access

### Drizzle discipline

- **All DB access via Drizzle, in backend repositories only.** No raw SQL strings except in audit log raw appends.
- **Repositories live in `apps/api/src/modules/<feature>/<feature>.repository.ts`.** Don't query inline in services — extract to repository methods.
- **Always include type-safe `where()` clauses.** Drizzle's `eq`, `and`, `or`, `inArray`.
- **Indexes are not optional** — see `database-schema.md` for required indexes.
- **Use `returning()`** when you need the inserted/updated row back. Don't re-query.
- **Schema lives in `packages/db/src/schema.ts`** — imported by `apps/api`; types may be imported by `apps/web` rarely.

### RLS is not optional

Every table that contains user data has RLS enabled. Policies live in `packages/db/src/rls/*.sql` and are applied via Supabase SQL editor by the human. **Never disable RLS to "speed up debugging"** — fix the policy.

---

## Auth & RBAC

### Backend: Guards on every controller

```ts
@Controller('jobs')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@ApiBearerAuth()
export class JobsController {
  @Post()
  @Roles('recruiter')
  async create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthUser) { ... }
}
```

`SupabaseAuthGuard` validates the JWT (signature + expiry + JWKs from Supabase). `RolesGuard` checks `user.role` against `@Roles(...)` decorator. `@CurrentUser()` injects the typed authenticated user.

For per-resource ownership checks (e.g., "this recruiter owns this job"), implement and apply `OwnershipGuard` in services or via custom guard.

### Frontend: middleware

`apps/web/middleware.ts` is the first line of defense:

```ts
if (pathname.startsWith("/candidate") && session?.user.role !== "candidate") {
  return NextResponse.redirect(new URL("/login", request.url));
}
```

Middleware redirects at the URL level. The backend's guards are the real authoritative check on every API call.

Both layers required — middleware can be bypassed (via direct API hits to backend), guards cannot.

---

## Error Handling

### Layered approach

1. **Validation errors** (Zod) → returned to form, displayed inline
2. **Authorization errors** (`UnauthorizedError`, `ForbiddenError`) → redirect or 403 page
3. **Business errors** (e.g., "Job is already closed") → returned as `{ success: false, error: "..." }` from Server Action, shown as toast or inline
4. **Unexpected errors** (DB connection, AI service down) → caught by error boundary, logged, generic friendly message

### Error boundary template

Every route group has `error.tsx`:

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="text-center py-16">
      <h2 className="text-title-md">Something went wrong</h2>
      <p className="text-body text-muted">{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### What NOT to do

- Don't `console.log` errors in production paths. Use a proper logger (or for sprint, `console.error` is fine but reviewed).
- Don't show raw stack traces to users.
- Don't suppress errors with empty catch blocks.

---

## AI Calls (Backend Only)

All AI calls happen in `apps/api/src/ai/`. The OpenAI key never reaches the frontend bundle.

### The discipline

1. **AI services live in the backend.** `apps/api/src/ai/*.service.ts`. Frontend triggers via REST endpoint.
2. **Always use structured outputs.** OpenAI's `response_format: { type: "json_schema", json_schema: { ... } }` with a Zod-derived JSON schema. No free-text parsing.
3. **Always include a timeout.** 30s for parsing, 15s for scoring. AbortController.
4. **Always have a fallback.** If AI fails, the user-facing path still works (manual entry, "Score temporarily unavailable").
5. **Always log AI calls** to audit (model, prompt version, latency, success/failure).
6. **Always show the user that AI is running.** Backend returns the data; frontend renders AI Shimmer while the request is in flight.
7. **PII redaction before scoring.** No exceptions.
8. **Long-running AI batch jobs use BullMQ.** User-triggered single calls run inline with shimmer.

See `ai-design.md` for the full prompt + schema spec.

---

## Email

- **Templates in `emails/`** as React components.
- **Send via Resend** through `lib/email/send.ts`.
- **Never block a Server Action on email send.** Either await with timeout, or fire-and-forget with logging.
- **Idempotency:** include a deduplication key for verification/reset emails to prevent duplicate sends within a window.

---

## Comments & Documentation

### Default: no comments

Well-named identifiers do the documentation work. If you're tempted to write a comment, first try renaming.

### When to write a comment

Only the **WHY**, never the WHAT. A comment is justified for:

- A non-obvious constraint (`// Supabase RLS requires this index for performance`)
- A workaround (`// Tiptap stores empty state as <p></p>; treat as empty`)
- A subtle invariant (`// audit_logs is append-only; never UPDATE this table`)

### What NOT to comment

- Don't restate code (`// Loop through users`)
- Don't reference current task (`// Added for the application flow`)
- Don't write multi-paragraph docstrings on internal functions
- Don't write JSDoc tags on every parameter (TypeScript types do it)

---

## File Hygiene

- **One concern per file.** Long files = split.
- **Imports ordered:** external → `@/` → relative.
- **No barrel `index.ts` re-exports** — direct imports keep tree-shaking honest.
- **Never commit `console.log` statements** in PR-ready code (sprint exception: `console.error` for unexpected errors is OK).

---

## Security Practices

### Secrets

- All secrets in `.env.local` (gitignored)
- Never read `process.env` in Client Components — only Server Components, Server Actions, Route Handlers, middleware
- `NEXT_PUBLIC_*` env vars are baked into the client bundle — only put non-sensitive vars there (Supabase anon key OK; service role key NEVER)

### Inputs

- All user inputs validated with Zod
- All file uploads MIME + size validated server-side
- All file paths normalized (no traversal)
- All HTML rendered through React (auto-escaped); rich-text fields sanitized via DOMPurify on display

### Outputs

- Never log full request bodies (PII risk)
- Never log secrets
- Audit logs sanitize sensitive fields (no passwords, no tokens)

### Rate limiting

- Auth endpoints: 5 attempts / 60s per IP + email
- Score recompute: 1 / 60s per user
- Resume upload: 5 / hour per user
- Bias check: trusted in flow (only fires from authenticated recruiters)

(For sprint, in-memory rate limit is acceptable; Phase 2 → Upstash Redis.)

---

## Accessibility

### Targets (WCAG 2.1 AA)

- Color contrast 4.5:1 minimum for text (verified for our token pairs)
- All interactive elements keyboard-navigable (`tab`, `enter`, `space`, `escape`)
- Focus rings visible (2px primary)
- Form inputs labeled; errors associated via `aria-describedby`
- Modals trap focus; `escape` closes
- Headings semantic (`<h1>` once per page, then sequential)
- Images have meaningful `alt` text (or `alt=""` for decorative)
- Icons-only buttons have `aria-label`
- Loading states announced via `aria-live="polite"`

### Don't

- Don't rely on color alone to convey meaning. Score band has color + label always.
- Don't disable focus rings.
- Don't use `<div onClick>` instead of `<button>`.

---

## Performance

### Sprint-realistic

- Server Components reduce client bundle by default
- Use `next/image` for any image (auto WebP, lazy-load, blur placeholder)
- Use `next/font` for fonts (no FOUT, self-hosted)
- Stream pages where parsing is slow (e.g., dashboards with multiple widgets)
- Defer non-critical client JS via `dynamic(() => import('...'), { ssr: false })`
- Keep client components small; large libraries (Recharts, Tiptap) lazy-loaded

### Don't pre-optimize

For sprint, ship the readable version. Profile if a real perf problem surfaces.

---

## Caching

Next.js 16 caching defaults differ from older versions. **Read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` before assuming behavior.**

Sprint approach:

- **Default `force-dynamic`** on portal pages (real-time-ish data)
- **`revalidatePath` after every write**
- **Public marketing pages cached** (default in Next 16)
- **No manual fetch caching strategies in sprint scope** — keep it simple

---

## Testing (Sprint Stance)

- No unit tests written in sprint. Type checking + Zod runtime + manual QA cover most regressions.
- **Manual QA test plan in `sprint-plan.md`** — specific paths to verify before sprint ends.
- Phase 2: Vitest for unit, Playwright for E2E.

---

## Code Review Self-Check

Before considering a piece of code "done," answer yes to all:

- [ ] No `any`. No `as` unless absolutely needed.
- [ ] Zod schema exists for any user input.
- [ ] Server Action has auth + role check at top.
- [ ] DB write paired with audit log if consequential.
- [ ] DB write paired with `revalidatePath`.
- [ ] Loading state present for any async UI.
- [ ] Error state present for any async UI.
- [ ] Empty state present for any list/table.
- [ ] Mobile responsive at 375px width.
- [ ] Keyboard navigable.
- [ ] No `console.log` in production paths.
- [ ] No comments that restate code.
- [ ] No premature abstraction.
- [ ] If AI runs: shimmer + caption + audit log.
- [ ] If destructive: modal confirmation.

---

## Common Pitfalls

### "I'll just call the DB from a Server Component"

**Forbidden.** Frontend has no DB access. All data flows through the backend REST API.

### "I'll just call OpenAI from the frontend"

**Forbidden.** OpenAI key is backend-only. Frontend triggers via `POST /api/v1/scoring/...`.

### "I'll inline this Zod schema in the form"

No — schemas live in `packages/shared/`. The same schema is consumed by the frontend form AND the backend DTO.

### "I'll put this controller in the auth module since it touches users"

No — features are modules. Auth handles login/register/session; user CRUD lives in the users module.

### "I'll add a feature flag for this"

No. We don't have a feature flag system in sprint. Either ship or don't.

### "I'll wrap this in try/catch in case it fails"

Only if you have a meaningful recovery path. Otherwise, let it bubble to the global exception filter.

### "I need a custom hook for this"

Most "custom hooks" are over-abstraction. If used in 2+ places, OK. Once is just code.

### "I'll add a small ORM helper here"

The repository layer (`apps/api/src/modules/<feature>/<feature>.repository.ts`) IS the helper. Don't add another layer.

### "I'll mock the AI call for now"

Mock at the prompt level (return canned JSON) only if the OpenAI key isn't set. Production code path always wired up.

### "I'll handle that case later"

Either handle now or write `// TODO: handle X` AND a task entry. Untracked TODOs rot.

### "I'll use Server Actions for this mutation"

We do NOT use Server Actions for backend logic in this architecture. Server Actions are reserved for frontend-only concerns like Supabase Auth flows. All DB / AI / email mutations go through the NestJS backend.

---

## Iteration Guide

1. Read the relevant doc first (`design-system.md` for styling, `architecture.md` for system patterns, etc.)
2. Find the right folder per `project-structure.md`
3. Write the Zod schema first, then the Server Action, then the form, then wire it up
4. Run TypeScript check after every meaningful change
5. Manually QA the path end-to-end before declaring done

The system rewards discipline. Cutting corners surfaces as bugs in the demo.
