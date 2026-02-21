# CLAUDE.md — AI Client Dashboard

This file provides guidance for AI assistants working in this codebase.

## Project Overview

**AI Client Dashboard** is a full-stack SaaS platform for managing client projects and tasks with automated AI workflows. It allows admins to assign AI agents to tasks, track job execution in real time, and route deliverables through a client approval process.

**Tech stack:**
- **Framework**: Next.js 14 (App Router, standalone output)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 18 + Tailwind CSS 3
- **Database**: Supabase (PostgreSQL with RLS)
- **AI**: Vercel AI SDK v6 (`ai` package) with multi-provider support
- **Validation**: Zod v4
- **Background jobs**: Node.js worker process (`workers/job-worker.ts`)

---

## Repository Structure

```text
src/
  app/              # Next.js App Router routes and API endpoints
  lib/
    agents/         # AI agent implementations
    llm/            # LLM utilities (JSON parsing, validation, Ollama client)
    workflows/      # Workflow engine and pre-built workflow definitions
    supabase/       # Supabase client setup and generated DB types
    utils/          # Shared helper functions
  components/       # React UI components
    ui/             # Primitive UI components (Button, Card, Badge, etc.)
  hooks/            # Custom React hooks (auth, projects, tasks, real-time)
  types/            # Centralized TypeScript type definitions (index.ts)
  styles/           # Global CSS

workers/
  job-worker.ts     # Background worker: polls and executes AI jobs

scripts/
  seed-workflows.ts # Seeds default workflows to the database

config/
  schema.sql        # Full Supabase PostgreSQL schema
  migrations/       # Incremental migrations

examples/           # Example workflow YAML definitions
```

---

## Development Workflows

### Running locally

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run worker       # Start background job worker (separate terminal)
npm run lint         # Run ESLint
npm run build        # Production build
npm run start        # Start production server
```

### Database

```bash
npm run db:migrate   # Push schema migrations (requires DATABASE_URL)
npm run db:seed      # Seed the 6 default AI workflows
```

### Docker

```bash
docker compose up    # Start web + worker (+ optional Ollama)
```

### Environment variables

Copy `.env.example` to `.env.local`. Required variables:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Used by worker only

# AI providers — at least one required
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
XAI_API_KEY=
OLLAMA_BASE_URL=                # Default: http://localhost:11434/v1

# Worker tuning (optional, defaults shown)
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENT_JOBS=3
WORKER_JOB_TIMEOUT_MS=300000
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o-mini
```

---

## Key Conventions

### TypeScript

- All types live in `src/types/index.ts`. Do not scatter type definitions across files.
- Path alias `@/*` maps to `src/*`. Always use it — never use relative paths like `../../`.
- Strict mode is enabled. Avoid `any`; use `unknown` and narrow.
- The project is ESM (`"type": "module"` in package.json). Use `.js` extensions in raw Node scripts if needed; Next.js handles this automatically.

### Import order (preferred)

1. External packages
2. Internal aliases (`@/types`, `@/lib/...`, `@/components/...`)
3. Relative imports (avoid; use aliases instead)

### Styling

- Use Tailwind CSS utility classes. Do not write custom CSS unless required.
- Use `clsx` + `tailwind-merge` (via `cn()` helper) to combine conditional classes.
- No CSS modules. No styled-components.

### API routes

- All API routes live under `src/app/api/`. Follow Next.js App Router conventions (`route.ts`).
- Return `ApiResponse<T>` shape from `src/types/index.ts` for consistency: `{ success, data?, error?, message? }`.
- Use Supabase server client (`createServerClient`) inside API routes — never the browser client.

### React components

- Server Components by default in App Router. Add `'use client'` only when required (event handlers, hooks, browser APIs).
- Custom hooks live in `src/hooks/`. Export everything through `src/hooks/index.ts`.
- UI primitives live in `src/components/ui/`. Export through `src/components/ui/index.ts`.

---

## AI Agent System

### Architecture

All agents extend `BaseAgent` (`src/lib/agents/base-agent.ts`). The base class handles:
- Provider selection (OpenAI, Anthropic, Google, xAI, Ollama)
- LLM invocation via Vercel AI SDK `generateText()`
- Ollama via direct HTTP (`callOllamaChat`)
- JSON extraction with multiple fallback strategies (`safeJsonParse`)
- Zod schema validation per agent type
- Structured logging (`JobLog[]`)
- Error classification (`classifyError`)

### Available agents

| Agent | File | Purpose |
|---|---|---|
| `ResearchAgent` | `agents/research-agent.ts` | Information gathering |
| `WriterAgent` | `agents/writer-agent.ts` | Content creation |
| `EditorAgent` | `agents/editor-agent.ts` | Content refinement |
| `SeoAgent` | `agents/seo-agent.ts` | Search Engine Optimization analysis |
| `PlannerAgent` | `agents/planner-agent.ts` | Project planning |

### Creating a new agent

1. Create `src/lib/agents/my-agent.ts` extending `BaseAgent`.
2. Override `buildUserPrompt()`, `getDefaultSystemPrompt()`, and `getFallbackOutput()`.
3. Register it in `src/lib/agents/index.ts` via `registerAgent('my-agent', MyAgent)`.
4. Add a Zod schema in `src/lib/llm/validation.ts` keyed to the agent name.

### LLM provider selection

The provider and model are resolved at runtime:

1. Job record in the database specifies `provider` + `model`.
2. Falls back to `DEFAULT_LLM_PROVIDER` / `DEFAULT_LLM_MODEL` env vars.
3. Defaults to `openai` / `gpt-4o-mini`.

Supported `LLMProvider` values: `'openai' | 'anthropic' | 'google' | 'xai' | 'ollama'`.

---

## Workflow System

### Pre-built workflows

Six default workflows are defined in `src/lib/workflows/default-workflows.ts` and seeded via `npm run db:seed`:

- Blog Post (Research → Outline → Writing → Editing → SEO → Approval → Publish)
- SEO Audit
- Landing Page
- Social Media Campaign
- Product Description
- Email Campaign

### Workflow step types

```typescript
type: 'ai'                // Run an AI agent
type: 'wait_for_approval' // Pause for client approval
type: 'publish'           // Mark deliverable as final
type: 'custom'            // Custom step logic
```

### Workflow execution flow

```text
POST /api/workflows/start
  → WorkflowExecutor.execute()  (src/lib/workflows/workflow-engine.ts)
  → For each step: run agent or wait for approval
  → Results stored in workflow_step_executions + ai_jobs tables
  → Task status updated in real time via Supabase
```

Approval steps pause execution and create an `Approval` record. The client responds via `PATCH /api/approvals/[id]`, which resumes the workflow.

---

## Background Worker

`workers/job-worker.ts` runs as a separate process and:
- Polls `claim_next_ai_job()` Supabase RPC (uses row-level locking — no double execution)
- Runs up to 3 concurrent jobs (`WORKER_MAX_CONCURRENT_JOBS`)
- Retries failed jobs with exponential backoff (1s → 2s → 4s + jitter)
- Reaps stuck jobs older than 30 minutes
- Shuts down gracefully on `SIGTERM`/`SIGINT`

In production, manage it with PM2 (`ecosystem.config.js`) or as a Docker service.

---

## Database Schema

Key tables and their relationships:

```text
users → clients → projects → tasks
                               ↓
                           ai_jobs (many per task)
                           workflow_executions → workflow_step_executions
                           approvals
                           deliverables
                           notifications
                           activity_logs
```

- All tables have Row Level Security (RLS) enabled.
- Use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) in worker and server-side admin routes only.
- Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser clients (respects RLS).

---

## Real-Time Updates

Hooks in `src/hooks/` subscribe to Supabase real-time channels:
- `use-realtime.ts` — generic subscription helper
- `use-task-realtime.ts` — live task status and job log updates

Components displaying live AI job logs should use these hooks rather than polling.

---

## Pages & Routes

| Route | File | Notes |
|---|---|---|
| `/` | Redirected → `/dashboard` | |
| `/dashboard` | `app/dashboard/page.tsx` | Stats overview |
| `/projects/[id]` | `app/projects/[id]/page.tsx` | Project detail |
| `/tasks/[id]` | `app/tasks/[id]/page.tsx` | Task detail + AI logs |
| `/ai-logs` | `app/ai-logs/page.tsx` | Real-time job log viewer |
| `/deliverables` | `app/deliverables/page.tsx` | Deliverable gallery |
| `/admin/projects` | `app/admin/projects/page.tsx` | Admin project management |
| `/(auth)/login` | `app/(auth)/login/page.tsx` | Auth |
| `GET /api/health` | `app/api/health/route.ts` | DB health + latency |
| `POST /api/workflows/start` | `app/api/workflows/start/route.ts` | Start a workflow |
| `PATCH /api/approvals/[id]` | `app/api/approvals/[id]/route.ts` | Client approval response |
| `GET/POST /api/ollama` | `app/api/ollama/route.ts` | Ollama model management |

---

## Known Issues

- **TypeScript type errors** in `src/lib/agents/base-agent.ts`: the Vercel AI SDK updated `CoreMessage` → `Message` in a breaking change. The import has been updated to use `type Message` from `ai`. `src/lib/llm/ollama.ts` is unaffected — it uses its own `OllamaChatMessage` type and does not import from the AI SDK.

---

## Testing

No test framework is currently configured. If adding tests, prefer **Vitest** (compatible with ESM and the existing TypeScript setup). Place test files adjacent to source files as `*.test.ts` or in a top-level `tests/` directory.

---

## Deployment

| Platform | Guide |
|---|---|
| Vercel + Railway | See `DEPLOYMENT.md` (web on Vercel, worker on Railway) |
| Docker Compose | `docker compose up` (web + worker + optional Ollama) |
| PM2 | `pm2 start ecosystem.config.js` |

The Next.js build uses `output: 'standalone'` for minimal Docker image size.
