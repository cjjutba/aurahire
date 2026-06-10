# Project Overview — AuraHire

> Brownfield scan by `[DP] Document Project` · 2026-06-10 · Index: [index.md](./index.md)

## Purpose
**AuraHire** is an AI-powered recruitment platform built as a thesis system demonstrating **explainable scoring** (every AI decision shows its work) and **active bias mitigation** (job descriptions checked before publish; resumes PII-redacted before scoring). Thesis angle: _"Explainable and Fair AI-Powered Recruitment: A Transparent Resume Scoring Platform with Bias Mitigation."_ Three roles: **Candidate, Recruiter, Admin**.

## Executive summary
A Turborepo + pnpm **monorepo** with a strict split: a Next.js 16 frontend (UI only) and a NestJS-on-Fastify backend that owns all DB, AI, queue, cron, cache, and secret handling. Shared Zod schemas and an orval-generated REST client give an end-to-end type chain. The system is feature-complete (18 backend modules, 21 DB tables, candidate/recruiter/admin portals) and is now being **migrated off Digital Ocean to a fully serverless stack** (Vercel + Neon Postgres + Upstash Redis), with auth re-platformed off the now-lost Supabase account and the domain moving to `aurahire.cjjutba.com`.

## Tech stack summary
| Layer | Stack |
|---|---|
| Monorepo | pnpm 9.12.3 · Turborepo 2.3.3 · TypeScript 5.7 strict |
| Frontend (`web`) | Next.js 16.2 (App Router) · React 19.2 · Tailwind v4 (CSS-first) · Base UI/radix/shadcn · TanStack Query 5 · RHF + Zod · Tiptap · Recharts · socket.io-client |
| Backend (`api`) | NestJS 10.4 on **Fastify** · Drizzle 0.36 + postgres.js · nestjs-zod · BullMQ · cache-manager · @nestjs/throttler · @nestjs/schedule · socket.io + redis-adapter · OpenAI 6 · Resend + react-email |
| Shared (`shared`) | Zod schemas/enums/constants · **orval** REST client · realtime contracts |
| Data (`db`) | Drizzle schema · 21 tables · 17 SQL migrations · RLS policies |
| External | Postgres (Supabase→**Neon**) · Auth (Supabase→**TBD**) · Redis (self-host→**Upstash**) · OpenAI gpt-4o-mini · Resend |

## Architecture type
- **Repository:** monorepo (4 workspace parts).
- **Frontend:** layered/component App-Router app, Server-Components-first.
- **Backend:** modular service/API-centric NestJS (module → controller → service → repository), five-layer defense-in-depth.

## Repository structure (parts)
| Part | Type | Root | Role |
|---|---|---|---|
| `web` | web (Next.js 16) | `apps/web` | UI only; no DB/AI keys |
| `api` | backend (NestJS/Fastify) | `apps/api` | owns DB, AI, queue, cron, cache, secrets |
| `shared` | library | `packages/shared` | Zod schemas, enums, orval client, realtime contracts |
| `db` | library | `packages/db` | Drizzle schema, migrations, RLS |

## Migration status (June 2026)
Active re-platform off Digital Ocean (droplet expiring/down → site down). Target: Vercel (web + API on Fluid Compute), Neon Postgres, Upstash Redis, Vercel Cron, Resend, domain `aurahire.cjjutba.com`. Auth must move off Supabase. See [deployment-guide.md](./deployment-guide.md) and the **Migration State** table in [`_bmad-output/project-context.md`](../_bmad-output/project-context.md).

## Where to go next
- New AI-context entry point: [index.md](./index.md)
- Hand-written product/design specs: [docs/main/](./main/) (`prd.md`, `architecture.md`, `database-schema.md`, `ai-design.md`, `tech-stack.md`, `design-system.md`, …)
- Migration planning (BMad): next is `[CA] Create Architecture` → `[CE] Epics & Stories` → `[SP] Sprint Planning`.
