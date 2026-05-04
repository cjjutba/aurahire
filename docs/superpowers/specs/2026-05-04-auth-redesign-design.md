# Auth Redesign — OpenAI Platform–Style, AuraHire-Branded

**Date:** 2026-05-04
**Scope:** All 8 pages under `apps/web/app/(auth)/` + their forms + the shared layout/card components.
**Visual reference:** OpenAI Platform login/signup flow (Mobbin captures, May 2026).

---

## Goals

1. Replace the boxed-card auth aesthetic with the OpenAI-style **no-card editorial layout**: top-left wordmark, centered form floating on the white canvas, dark footer bar with Terms · Privacy.
2. Keep AuraHire's brand voltage exactly where it already lives: the primary CTA pill (`#2563eb`), inline links, focus rings. No new accent colors. No black CTAs.
3. Adopt OpenAI's **floating-label pill input** as the canonical auth field.
4. Apply the pattern consistently across all 8 auth pages, including the AuraHire-specific role-select page (no OpenAI analogue).
5. Preserve current auth flow exactly — no email-first multi-step refactor, no OAuth, no schema changes, no API changes.

## Non-Goals

- OAuth / social login providers.
- Multi-step (email-first → password) flow.
- Touching any non-auth pages (marketing, portals).
- Redesigning the design system tokens (`globals.css` `@theme` block stays as-is).
- Any backend, schema, or API changes.

---

## Pages In Scope (8)

| Path                              | What it is                                    |
| --------------------------------- | --------------------------------------------- |
| `/login`                          | Email + password sign-in                      |
| `/register`                       | Role-select (Candidate / Recruiter)           |
| `/register/candidate`             | 5-field candidate signup                      |
| `/register/recruiter`             | 6-field recruiter signup (incl. company name) |
| `/forgot-password`                | Email → send reset link                       |
| `/reset-password`                 | New password + confirm (from email link)      |
| `/verify-email`                   | Token landing page (verify result states)     |
| `/verify-email/sent`              | Post-signup "check your inbox" message        |

---

## Design System

### Layout chrome (applies to every auth page)

```
┌─────────────────────────────────────────────────────┐
│  AuraHire                                           │  ← header: top-left wordmark
│                                                     │     1px hairline-soft bottom border
│                                                     │
│                  ┌──────────────┐                   │
│                  │              │                   │
│                  │   <form>     │                   │  ← body: centered form,
│                  │              │                   │     max-width 360px (sm) / 400px (md+)
│                  │              │                   │     no card, no shadow
│                  └──────────────┘                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ▪ AuraHire     Terms  |  Privacy                   │  ← footer: dark surface
└─────────────────────────────────────────────────────┘     ink bg, on-dark-soft text
```

- **Page background:** `var(--color-canvas)` (#ffffff). Drops `bg-[var(--color-surface-soft)]` from current `(auth)/layout.tsx`.
- **Header:** `flex justify-start`, padding `24px 32px`, 1px `var(--color-hairline-soft)` bottom border. Wordmark = "AuraHire" plain text, `font-semibold` (Inter 600), 18px, links to `/`.
- **Main:** `flex-1`, `flex items-center justify-center`, vertical padding `48px 16px` (mobile) → `80px 24px` (desktop).
- **Footer:** `bg-[var(--color-surface-dark)]` (#0a0b0d), `text-[var(--color-on-dark-soft)]` (#a8acb3), padding `20px 32px`, `text-xs`. Layout: AuraHire glyph (12px square `bg-[var(--color-primary)]` rounded-sm) + "AuraHire" wordmark left, "Terms · Privacy" links right (links use `text-[var(--color-on-dark)]` with hover underline).

### Form headline + subtitle

- **Headline:** `text-3xl font-normal tracking-[-0.5px] text-center text-[var(--color-ink)]` (Inter Display 400, 28–30px). One line per page; copy listed in the page table below.
- **Subtitle (optional):** `text-sm text-[var(--color-body)] text-center max-w-[320px] mx-auto leading-relaxed`. Only appears when content is non-obvious (e.g., "Find your next role with explainable AI matching." on candidate signup).
- **Spacing:** Headline `mb-2`. Subtitle `mb-8`. Subtitle-to-form gap stays `mb-8` even when subtitle is absent (so form positioning is consistent across pages).

### Role tag (signup pages only)

Above the H1 on `/register/candidate` and `/register/recruiter`:

```html
<span class="inline-block bg-[var(--color-surface-strong)] text-[var(--color-body)]
  text-[10px] font-semibold tracking-[0.06em] uppercase
  px-3 py-1 rounded-full mb-4">
  Candidate
</span>
```

Centered. Reads as a quiet wayfinding chip so the user knows which signup they're on.

### Floating-label pill input

The canonical auth input. Replaces the current shadcn `<Input>` for auth pages only (portal/marketing inputs unchanged).

Behavior:
- Resting state: empty input shows placeholder ("Email address") inside the pill, color `var(--color-muted-soft)`.
- On focus: 2px `var(--color-primary)` border replaces the 1px hairline.
- On focus or when filled: the placeholder text shrinks to 11px, `font-medium`, color `var(--color-body)`, and animates to sit on the top edge of the pill (with a small white background pad to "cut" the border).
- Error state: 2px `var(--color-status-danger)` border, error message rendered below input in `text-xs text-[var(--color-status-danger)]`.

Geometry:
- Height 52px (slightly taller than current 44px to comfortably contain the floated label).
- Padding `0 20px`.
- Border 1px `var(--color-hairline)`, radius `var(--radius-pill)` (100px).
- Font: 15px, color `var(--color-ink)`.

Implementation: a new component `<AuthInput label={...} error={...} ...inputProps>` wrapping a native `<input>` with controlled label transitions via Tailwind `peer` utilities (no extra animation library needed). Component lives in `apps/web/components/auth/auth-input.tsx`.

### Primary CTA

No change to color: `bg-[var(--color-primary)]`, hover `bg-[var(--color-primary-active)]`, disabled `bg-[var(--color-primary-disabled)]`. Geometry stays `rounded-[var(--radius-pill)]`, height 48px, full width inside the form. Label is Inter 600 / 16px, white. Loading state: replace label with "Signing in..." / "Creating account..." (current behavior preserved).

### Role select cards (`/register`)

Stacked, full-width pill-shaped rows (not the current rounded-xl boxes). Each card:

- Container: `flex items-center gap-4`, padding `18px 24px`, border 1px `var(--color-hairline)`, radius `var(--radius-pill)`, white background.
- Hover: border thickens to 2px `var(--color-primary)`, background tints to `var(--color-primary-soft)` at very low opacity (~20%) — call it `bg-[var(--color-primary-soft)]/30`.
- Leading icon: 32px circle, `bg-[var(--color-surface-strong)]`, centered Lucide icon (`User` for Candidate, `Briefcase` for Recruiter), icon color `var(--color-body)`.
- Primary label: Inter 600 / 14px, `var(--color-ink)`.
- Secondary label: Inter 400 / 12px, `var(--color-body)`, `mt-0.5`.
- Trailing chevron: Lucide `ChevronRight`, 16px, `var(--color-muted)`.

### Trailing link row ("Don't have an account? Sign up")

`text-center text-sm text-[var(--color-body)]`, `mt-6` from the CTA. The link itself is `text-[var(--color-primary)] hover:underline`. Same pattern across login / register / role-pages.

### Inline "Forgot?" link

Removed from inline-with-Password-label position (current). Replaced with a left-aligned `text-xs text-[var(--color-primary)] hover:underline` placed `mt-1 mb-3` below the password input. This decouples it from the floating label, which crowds it.

### Footer details

- Always present, always dark.
- Single shared component: `<AuthFooter />` rendered by the `(auth)/layout.tsx`.
- Static links: `<Link href="/legal/terms">Terms</Link>` / `<Link href="/legal/privacy">Privacy</Link>`.
  - **Note:** these routes don't exist yet. Render the links pointing at the correct paths regardless; if the routes 404 today, that's a pre-existing gap (and out of scope for this redesign).

### Spacing & breakpoints

- Form max-width: `max-w-[360px]` mobile/sm, `max-w-[400px]` md+ (`sm:max-w-[400px]`).
- Page vertical padding: header → form: `pt-12` mobile → `pt-20` md+.
- Field gap: `space-y-3` (12px) — slightly tighter than current `space-y-4` to prevent the long candidate signup from running off-screen.
- All breakpoints respect existing AuraHire responsive scale; no new breakpoints introduced.

### Accessibility

- Floating-label component must associate `<label>` with `<input>` via `htmlFor` / `id` (NOT placeholder-as-label). The visual "floating" behavior is decorative; the underlying semantic is a real `<label>`.
- Focus visible: 2px primary border + matches WCAG AA contrast on white.
- Error messages use `aria-invalid="true"` + `aria-describedby` linking to error text node.
- Footer Terms / Privacy links use `<Link>` with discernible link text.
- Tap targets: 44px minimum maintained (52px input height, 48px CTA, 56px role cards).

---

## Per-Page Specs

### `/login`

- H1: **Welcome back**
- Subtitle: none
- Fields: Email (floating label "Email address"), Password (floating label "Password")
- Forgot link: below password input, left-aligned
- CTA: "Sign In"
- Trailing link row: "Don't have an account? Sign up" → `/register`

### `/register` (role select)

- H1: **Create your account**
- Subtitle: "Choose your role to get started."
- Body: two stacked role cards (Candidate, Recruiter)
- No CTA button (the cards themselves are the CTAs)
- Trailing link row: "Already have an account? Sign in" → `/login`

### `/register/candidate`

- Role tag: "Candidate"
- H1: **Sign up as a candidate**
- Subtitle: "Find your next role with explainable AI matching."
- Fields: Full Name, Email, Phone (placeholder `+639171234567`), Password, Confirm Password
- Terms blurb: small `text-xs text-[var(--color-muted)] text-center` between Confirm Password and CTA, copy unchanged
- CTA: "Create Account"
- Trailing link row: "Already have an account? Sign in" → `/login`

### `/register/recruiter`

- Role tag: "Recruiter"
- H1: **Sign up as a recruiter**
- Subtitle: "Post jobs and find qualified candidates with bias mitigation built in."
- Fields: Full Name, Company Name, Work Email, Phone, Password, Confirm Password
- Terms blurb + CTA + trailing link row: same pattern as candidate.

### `/forgot-password`

- H1: **Forgot password**
- Subtitle: "Enter your email and we'll send a reset link."
- Fields: Email
- CTA: "Send Reset Link"
- Trailing link row: "Remember it? Sign in" → `/login`

### `/reset-password`

- H1: **Set a new password**
- Subtitle: "Choose a new password to finish resetting."
- Fields: New Password, Confirm Password
- CTA: "Update Password"
- Trailing link row: none (this is a one-shot landing from email link)

### `/verify-email` (token landing page)

Three states based on backend response (current behavior preserved):

- **Verifying:** H1 "Verifying your email..."; small spinner element (Lucide `Loader2` rotating) below; no CTA. Subtitle: "This will only take a moment."
- **Success:** H1 "Email verified"; subtitle "You can now sign in to your account."; CTA "Continue to sign in" → `/login`.
- **Failure:** H1 "Verification failed"; subtitle "This link is expired or invalid. Try requesting a new verification email."; CTA "Back to sign in" → `/login`.

### `/verify-email/sent`

- H1: **Check your inbox**
- Subtitle: "Enter the verification code we just sent to **{email}**." — bold the email in `var(--color-ink)`. If `email` query param missing, fall back to "your inbox".
- Body copy (below subtitle, optional): "Click the link in the email to activate your account. The link expires in 24 hours. Don't see it? Check your spam folder." — `text-sm text-[var(--color-body)] text-center max-w-[320px] mx-auto leading-relaxed`.
- CTA: "Back to sign in" → `/login` (rendered as primary blue pill, full-width).

---

## Component & File Changes

### New components

- `apps/web/components/auth/auth-shell.tsx` — replaces `(auth)/layout.tsx`'s body wrapper. Provides centered max-width, vertical padding, headline + subtitle slots.
- `apps/web/components/auth/auth-input.tsx` — floating-label pill input. Drop-in replacement for `<Input>` inside auth forms only.
- `apps/web/components/auth/auth-footer.tsx` — dark Terms · Privacy footer bar.
- `apps/web/components/auth/auth-role-tag.tsx` — small uppercase wayfinding chip.
- `apps/web/components/auth/auth-role-card.tsx` — full-width pill role row (used on `/register`).

### Modified components

- `apps/web/app/(auth)/layout.tsx` — header becomes top-left wordmark, drops the soft-grey background, footer swaps for `<AuthFooter />`.
- `apps/web/components/auth/login-form.tsx`, `register-candidate-form.tsx`, `register-recruiter-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` — swap shadcn `<Input>` for `<AuthInput>`, drop `<FormLabel>` (label now lives inside `<AuthInput>`), keep all `react-hook-form` / `zodResolver` wiring intact.
- All page files (`(auth)/.../page.tsx`) — remove `<AuthCard>` wrappers, render `<AuthShell title=... subtitle=...>` directly with the form children.

### Removed components

- `apps/web/components/auth/auth-card.tsx` — superseded by `<AuthShell>`. Delete after all consumers migrate.

### CSS / token changes

- No new tokens. Everything composes from the existing `globals.css` `@theme` block.
- One small addition to `globals.css` for the floating-label peer utility — a single CSS keyframe / transition rule. Will be added inline as utility classes if Tailwind v4 supports it via `peer-focus:` / `peer-[:not(:placeholder-shown)]:` (it does), so no custom keyframe should be required.

---

## Data flow & validation

Unchanged. Every form keeps its existing Zod schema (`@aurahire/shared`), `react-hook-form` resolver, submit handler, error mapping, toast notifications, and post-submit navigation. The redesign is **purely presentational**: same network calls, same redirects, same auth state.

Error display moves from shadcn `<FormMessage>` to inline error text rendered by `<AuthInput>` (the new component renders its own error slot below the input). The `react-hook-form` field `errors` object remains the source of truth; we just stop using shadcn's `<Form>` / `<FormItem>` / `<FormMessage>` wrappers inside auth forms.

---

## Testing

- Manual visual review across all 8 pages at three breakpoints (375px, 768px, 1280px), per AuraHire's design system.
- Tab-order check on every page.
- Floating label transition smoke test (focus → fill → blur → empty → blur).
- Existing auth flows (login → portal redirect, signup → verify-email/sent, forgot-password → email send → reset-password → login) continue to work end-to-end.
- No new unit tests required; no logic changed.

---

## Migration / Rollout

Single PR, single deploy. No feature flag — auth UI is internal-facing pre-launch and the redesign is presentational.

Order of file changes (recommended):
1. Add new auth components (`AuthShell`, `AuthInput`, `AuthFooter`, `AuthRoleTag`, `AuthRoleCard`).
2. Update `(auth)/layout.tsx` to consume `<AuthFooter />` + new header.
3. Migrate `/login` first as the simplest 2-field reference.
4. Migrate `/register` (role select).
5. Migrate `/register/candidate`, `/register/recruiter`.
6. Migrate `/forgot-password`, `/reset-password`.
7. Migrate `/verify-email`, `/verify-email/sent`.
8. Delete `<AuthCard>`.

---

## Out of Scope (explicit)

- OAuth providers (Google / Apple / Microsoft)
- Email-first multi-step flow
- Password strength meter
- "Show password" eye toggle (could be a follow-up — not OpenAI's verbatim pattern, they have it on `/create-password` only)
- Marketing pages, portal pages, admin pages
- Design token changes
- Any backend, schema, or API changes
- Legal pages (`/legal/terms`, `/legal/privacy`) — links exist in the new footer but those routes are pre-existing gaps, separate concern

---

## Open questions for implementation phase

None blocking. The implementation plan (writing-plans skill) will choose the exact Tailwind utility class pattern for the floating label (`peer-placeholder-shown:translate-y-X` etc.).
