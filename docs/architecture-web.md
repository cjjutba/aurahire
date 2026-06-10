# Architecture — Web (`apps/web`)

> Part: **web** (Next.js 16 App Router, React 19) · Brownfield deep-scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)
> Companion docs: [Component Inventory](./component-inventory-web.md) · [Integration Architecture](./integration-architecture.md)

`apps/web` is the Next.js 16 (App Router) frontend. Stack: React 19.2, Tailwind v4 (CSS-first), Base UI primitives (`@base-ui/react`) with `radix-ui` secondary, TanStack Query v5, RHF + Zod, Supabase SSR auth, socket.io-client realtime. UI is strictly presentational — no DB, no AI keys; all data goes frontend → NestJS backend.

## App Router structure (route groups)

Six route groups under `app/`, each with its own `layout.tsx`. Root `app/layout.tsx` wraps the provider stack and loads `Inter` + `JetBrains_Mono` via `next/font/google`.

**`(public)`** — MarketingNav + MarketingFooter, `dynamic = "force-dynamic"`: `/`, `/jobs`, `/jobs/[id]`.

**`(auth)`** — centered brand shell: `/login`, `/forgot-password`, `/reset-password`, `/register`, `/register/candidate`, `/register/recruiter`, `/verify-email`, `/verify-email/sent`.

**`(candidate)`** — server `getCurrentProfile()` gate (redirects non-candidate/admin to `/login`, incomplete → `/onboarding/candidate`; `PortalShell role="candidate"`): `/candidate` (dashboard), `/candidate/jobs[/[id][/apply]]`, `/candidate/applications[/[id]]`, `/candidate/interviews[/[id]]`, `/candidate/profile`, `/candidate/resume`, `/candidate/settings/{profile,security,notifications,privacy}`, `/candidate/help`, `/candidate/how-it-works`.

**`(recruiter)`** — recruiter/admin gate (incomplete → `/onboarding/recruiter`; wraps children in `ActiveCompanyProvider` + `CompanySwitchOverlay` + `PortalShell`): `/recruiter` (dashboard), `/recruiter/jobs` + `/jobs/{new,[id],[id]/edit,[id]/applications}`, `/recruiter/applications` + `/applications/[id]`, `/recruiter/shortlist`, `/recruiter/interviews` + `/interviews/[id]`, `/recruiter/offers` + `/offers/new`, `/recruiter/analytics`, `/recruiter/settings/{profile,company,members,scoring,bias,interview-venues,integrations,notifications,privacy,security,danger}`, help, how-it-works.

**`(admin)`** — admin-only gate: `/admin` (dashboard), `/admin/{users,companies,jobs,applications,analytics,audit,bias-monitor,ai-config,feedback,help,how-it-works}`.

**`(legal)`** — `/legal/privacy`, `/legal/terms`.

**Ungrouped** (own `layout.tsx`): `app/onboarding/` (`start`, `invite`, `candidate/{personal,preferences,analyzing,review}`, `recruiter/{focus,company-create}`); `app/invite/` (`/invite`, `/invite/[token]`).

Layout nesting: root → group layout → (settings sub-layout). Candidate/recruiter/admin groups share `PortalShell` (sidebar + mobile drawer). Most routes ship a sibling `loading.tsx` skeleton.

## Rendering model & data fetching

- **Server Components are the default.** Each `page.tsx` is an async Server Component that gates auth, awaits `searchParams` (a Promise in Next.js 16), prefetches data into a request-scoped QueryClient, then hands off to a co-located `"use client"` island. ~**111** `_*-client.tsx` islands exist under `app/`.
- **Two fetch paths** (both target `NEXT_PUBLIC_API_URL`, default `http://localhost:3333`):
  - Server: `serverApiFetch<T>()` (`lib/query/server-fetch.ts`, `import "server-only"`) reads the Supabase session via `getCurrentSession()` and attaches `Authorization: Bearer <jwt>`; `cache: "no-store"`; throws `ServerApiError`.
  - Client: `clientApiFetch<T>()` (`hooks/_client-fetch.ts`) reads the token from the `@aurahire/shared` singleton via `getAccessToken()`, adds `X-Active-Company-Id`; `credentials: "include"`; throws `ClientApiError` (with `.response.status` shim for React Query retry policy).
- **SSR prefetch → hydrate pattern:** pages call `makeQueryClient()`, `prefetchQuery({ queryKey: queryKeys.X, queryFn: serverQueries.X })`, wrap the island in `<PrefetchedHydration>` (`lib/query/hydration.tsx`). Avoids the cold-load 401 race where the bearer token is null on first client mount. Canonical example: `app/(candidate)/candidate/jobs/page.tsx`.
- **Orval client:** the generated REST client lives in `@aurahire/shared`, imported directly in ~10 islands; the dominant pattern is the thin `clientApiFetch`/`serverApiFetch` wrappers + TanStack Query hooks. The shared package exposes `setAccessToken`, `getAccessToken`, `setActiveCompanyResolver`, `fetcher`.

## Auth on the frontend

- **`middleware.ts`** (matcher excludes assets + `api` + dotted paths): builds a Supabase server client (`@supabase/ssr` `createServerClient`), `supabase.auth.getUser()`, then: unauthenticated → portal route → redirect `/login?redirect=<path>`; authenticated → `/login|/register|/forgot-password` → redirect `/candidate` (per-role routing is a Phase-2 TODO; JWT has no role claim yet). `/verify-email`, `/reset-password` excluded so Supabase callbacks work. Honors a `SESSION_ONLY_MARKER` cookie ("Remember me = false") by stripping `Max-Age`/`Expires` from refreshed cookies (mirrored in `lib/auth/client.ts` and `lib/auth/server.ts`).
- **Role enforcement is in the group layouts**, not middleware: each portal `layout.tsx` calls `getCurrentProfile()` (`lib/auth/session.ts`) + `redirect("/login")` on mismatch, plus onboarding redirects.
- **JWT attachment:** `AuthTokenProvider` (`components/providers/auth-token-provider.tsx`) subscribes to Supabase `onAuthStateChange`, writes the token into the `@aurahire/shared` singleton via `setAccessToken()`, and installs the active-company resolver. The Supabase browser client is built inside `useEffect` (not at render) because Next.js 16 static prerender strips `NEXT_PUBLIC_*` server-side and the Supabase factory throws synchronously — hence every portal layout forces `dynamic = "force-dynamic"`.

> **Auth-migration flag:** all of this (`@supabase/ssr`, `middleware.ts`, `AuthTokenProvider`, `lib/auth/*`) is Supabase-specific and must be re-platformed.

## State management & providers

- **Provider stack** (root layout, outer→inner): `AuthTokenProvider` → `QueryProvider` → `SocketProvider` → `ConfirmProvider` → children + `<Toaster>`.
  - `QueryProvider`: one browser-singleton `QueryClient` (`staleTime 60s`, `gcTime 5m`, `refetchOnWindowFocus: false`, no retry on 401/403/404 else up to 2). Devtools in dev.
  - `SocketProvider`: singleton socket.io connection per tab; recreates on token rotation, tears down on sign-out; logs server `subscribe_error` RBAC rejections.
  - `ConfirmProvider`: imperative confirm-dialog context.
- **React Contexts:** only `contexts/active-company-context.tsx` (`ActiveCompanyProvider`/`useActiveCompany`, recruiter-only) — manages the multi-tenant active-company id (localStorage singleton seeded from server `lastActiveCompanyId`), memberships query, and `switchCompany()` (synchronous header update → `PATCH /profiles/me` → `queryClient.clear()` → `useTransition` SSR refresh → overlay). The socket context lives in `socket-provider.tsx`.
- **Query layer** (`lib/query/`): `keys.ts` (centralized `queryKeys` factory), `queries.ts`/`server.ts` (server-only query fns), `server-fetch.ts`, `hydration.tsx`, `query-client.ts`.

## Key libraries & where used

- **Tailwind v4 (CSS-first):** `app/globals.css` with `@import "tailwindcss"` + an `@theme {}` block defining all design tokens as CSS vars (`--color-primary: #2563eb`, scoring colors, radius, spacing, fonts) plus a **shadcn token bridge**. No `tailwind.config` JS. `tw-animate-css` for animations; `@tailwindcss/postcss`.
- **UI primitives:** **Base UI** (`@base-ui/react`) primary; `radix-ui` secondary; `class-variance-authority` for variants; `cn()` (`lib/utils.ts`).
- **Tiptap** (rich-text JD editor with inline bias highlighting): `components/jobs/tiptap-editor.tsx`, `_bias-highlight-extension.ts`, `_use-debounced-bias-check.ts`, `rich-text-content.tsx`.
- **Recharts** (admin only): analytics + bias-monitor chart islands.
- **pdfjs-dist** (resume PDF highlight preview): `components/onboarding/resume-preview/pdf-renderer.tsx`.
- **socket.io-client:** `lib/realtime/client.ts`; hooks `use-realtime-room.ts`, `use-realtime-channel.ts`, `use-candidate-realtime.ts`, `use-user-notifications.ts`; event types re-exported from `@aurahire/shared`.
- **sonner** (toasts): `lib/toast.ts` helpers; `<Toaster>` in root layout. **next-themes:** only inside `components/ui/sonner.tsx` (app is light-mode only).
- **Forms:** `react-hook-form` + `@hookform/resolvers` + shared Zod schemas from `@aurahire/shared`.

## lib/ and hooks/ summary

**`lib/`** — `auth/{client,server,session,cookie-persistence}.ts`; `query/{keys,queries,server,server-fetch,hydration,query-client,index}`; `active-company.ts` (localStorage singleton read on every client fetch); `dashboard-prefetch.ts`; `memberships-server.ts`; `invitation-preview.ts`, `invite-cookie.ts`; `labels.ts`; `audit/humanize-action.ts`; `realtime/{client,events,rooms,index,use-candidate-realtime,use-user-notifications}`; `toast.ts`; `utils.ts` (`cn`).

**`hooks/`** (all `"use client"`, TanStack Query over `clientApiFetch`) — `_client-fetch.ts` (base); `use-applications`, `use-candidate-jobs`, `use-recruiter-jobs`, `use-match-previews`, `use-profile-score`, `use-interviews`, `use-shortlist`, `use-resumes`, `use-company`, `use-members`, `use-membership`, `use-dashboard`, `use-realtime-room`, `use-realtime-channel`, `use-invalidate-queries`, `use-debounced-router-refresh`.

## Notable conventions / gotchas

- **No DB or AI imports in `apps/web`, ever.** All data crosses to the NestJS backend; OpenAI/Supabase-Storage/DB are backend-only.
- **Next.js 16 specifics:** `params`/`searchParams` are Promises (await them). Every portal/public layout sets `dynamic = "force-dynamic"` because Supabase client construction throws during static prerender — follow this for new authed routes.
- **Page = Server Component shell, interactivity = co-located `_*-client.tsx` island.** Prefer SSR-prefetch → `PrefetchedHydration` over client-only fetching.
- **Tokens, not hex.** Use CSS vars from `globals.css` `@theme`. Scoring red/amber/green are fill/text only; lifecycle states use `--color-status-*`.
- **Multi-tenant header:** recruiter client fetches carry `X-Active-Company-Id`, injected automatically by `clientApiFetch` — don't bypass the wrapper. `useActiveCompany()` returns `null` outside the recruiter tree.
- **Auth gating in two places:** middleware (coarse) + group `layout.tsx` (role + onboarding). Add role checks in the layout (JWT has no role claim).
- **Toasts via `lib/toast.ts`; confirms via `ConfirmProvider`; forms via shared Zod schemas + RHF.**
