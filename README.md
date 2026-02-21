# AI Client Dashboard

מערכת SaaS מבוססת AI לניהול פרויקטים, משימות ו-workflows אוטומטיים — בנויה עם Next.js 14, Supabase ו-Vercel AI SDK.

---

## תוכן העניינים

1. [מה בנינו](#מה-בנינו)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [מה יש לנו ביד](#מה-יש-לנו-ביד)
4. [מה אפשר לעשות עם זה](#מה-אפשר-לעשות-עם-זה)
5. [מצב נוכחי](#מצב-נוכחי)
6. [איך ממשיכים מפה](#איך-ממשיכים-מפה)
7. [Setup מהיר](#setup-מהיר)
8. [מבנה הפרויקט](#מבנה-הפרויקט)
9. [AI Agents](#ai-agents)
10. [Workflows](#workflows)
11. [LLM Providers](#llm-providers)
12. [Ollama — מודלים מקומיים](#ollama--מודלים-מקומיים)
13. [Database Schema](#database-schema)
14. [API Reference](#api-reference)
15. [Background Worker](#background-worker)
16. [Deployment](#deployment)

---

## מה בנינו

**AI Client Dashboard** הוא פלטפורמת SaaS שמאפשרת להריץ workflows של AI אוטומטיים על פרויקטים ומשימות של לקוחות.

במקום להריץ AI ידנית בכל פעם — אתה מגדיר workflow אחד (לדוגמה: "Blog Post") שמריץ לבד: Research → Outline → Writing → Editing → SEO → אישור לקוח → Publish.

### הרעיון בשורה אחת

```
לקוח שולח בקשה → מערכת יוצרת Task → Worker מריץ AI Agents בסדר → לקוח מאשר → תוצר סופי
```

---

## ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│   Dashboard │ Projects │ Tasks │ AI Logs │ Deliverables         │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP / Realtime
┌───────────────────────▼─────────────────────────────────────────┐
│                       API Routes                                │
│  /api/health │ /api/workflows/start │ /api/approvals │ /api/ollama │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│                     Supabase (PostgreSQL)                       │
│   projects │ tasks │ ai_jobs │ workflows │ approvals │ ...      │
│   RLS │ Realtime │ RPC Functions                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │ claim_next_ai_job() — row-level lock
┌───────────────────────▼─────────────────────────────────────────┐
│                     Background Worker                           │
│   Poll → Claim → Execute Agent → Advance Workflow → Repeat      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
          ┌─────────────┼──────────────────┬────────────┐
          ▼             ▼                  ▼            ▼
       OpenAI       Anthropic           Google          xAI
      (gpt-4o)    (claude-3.5)    (gemini-2.0-flash) (grok-3)
                                                          +
                                                       Ollama
                                                  (מקומי, בחינם)
```

### Stack טכני

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) + RLS |
| Realtime | Supabase Realtime |
| AI SDK | Vercel AI SDK v6 |
| Validation | Zod v4 |
| Worker | Node.js / tsx |
| Deployment | Vercel (frontend) + Docker/Railway (worker) |

---

## מה יש לנו ביד

### Frontend — דפים עובדים

| דף | נתיב | תיאור |
|----|------|--------|
| Dashboard | `/dashboard` | סטטיסטיקות, פרויקטים פעילים, משימות אחרונות |
| Projects | `/projects/[id]` | פרטי פרויקט, timeline, משימות |
| Tasks | `/tasks/[id]` | פרטי משימה, logs AI, outputs |
| AI Logs | `/ai-logs` | כל ה-jobs ב-realtime |
| Deliverables | `/deliverables` | גלריית תוצרים סופיים |
| Admin | `/admin/projects` | ניהול פרויקטים (admin) |
| Login | `/login` | אימות |

### API Endpoints

| Method | Route | תיאור |
|--------|-------|--------|
| `GET` | `/api/health` | בדיקת DB + latency |
| `POST` | `/api/workflows/start` | הפעלת workflow על task |
| `PATCH` | `/api/approvals/[id]` | מענה לאישור (approved/rejected/revision) |
| `GET` | `/api/ollama` | סטטוס Ollama + רשימת מודלים |
| `POST` | `/api/ollama` | pull/delete/info מודל |

### AI Agents (6)

| Agent | קובץ | תפקיד |
|-------|------|--------|
| `ResearchAgent` | `research-agent.ts` | חיפוש מידע, ניתוח נושא |
| `WriterAgent` | `writer-agent.ts` | כתיבת תוכן (blog, landing page, email) |
| `EditorAgent` | `editor-agent.ts` | עריכה, תיקון שגיאות, שיפור סגנון |
| `SeoAgent` | `seo-agent.ts` | אופטימיזציה למנועי חיפוש |
| `PlannerAgent` | `planner-agent.ts` | תכנון פרויקט, פירוק ל-milestones |
| *(BaseAgent)* | `base-agent.ts` | בסיס מופשט לכל ה-agents |

### Workflows (6 מובנים)

| Workflow | שלבים | שימוש |
|----------|-------|--------|
| Blog Post | Research → Outline → Writing → Editing → SEO → Approval → Publish | פוסטים לבלוג |
| SEO Audit | Research → SEO Analysis → Report → Approval | ביקורת SEO |
| Landing Page | Research → Planning → Writing → Editing → Approval → Publish | דפי נחיתה |
| Social Media Campaign | Research → Planning → Writing → Approval | קמפיינים |
| Product Description | Research → Writing → Editing → SEO → Approval | תיאורי מוצר |
| Email Campaign | Research → Planning → Writing → Editing → Approval | אימייל מרקטינג |

### LLM Providers (5)

| Provider | מודלים מומלצים | משתנה סביבה |
|----------|---------------|-------------|
| OpenAI | `gpt-4o`, `gpt-4o-mini` | `OPENAI_API_KEY` |
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| Google | `gemini-2.0-flash`, `gemini-2.0-pro` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| xAI | `grok-3`, `grok-3-fast`, `grok-3-mini` | `XAI_API_KEY` |
| Ollama | כל מודל מקומי | `OLLAMA_BASE_URL` |

### Background Worker

- Polling חכם עם `claim_next_ai_job()` RPC (row-level lock — אין כפל הרצה)
- עד 3 jobs במקביל
- Exponential backoff retry (3 ניסיונות)
- זיהוי jobs תקועים (`reap_stuck_jobs`)
- Graceful shutdown (SIGTERM/SIGINT)
- Workflow continuation אוטומטי

### Ollama Manager

- זיהוי שירות אוטומטי (running / unreachable / not_installed)
- הוראות התקנה לפי OS (Linux/macOS/Windows)
- טבלת מודלים מותקנים (גודל, params, quantization)
- Pull מודל עם progress bar בזמן אמת
- מחיקת מודלים

### Database (Supabase)

- **8 טבלאות פעילות**: projects, tasks, ai_jobs, workflows, workflow_executions, workflow_step_executions, approvals, deliverables
- **RLS מופעל** על כל הטבלאות
- **3 RPC functions**: `claim_next_ai_job()`, `reap_stuck_jobs()`, `touch_updated_at()`
- **6 workflows** בתור

---

## מה אפשר לעשות עם זה

### Use Case 1: סוכנות תוכן

לקוח מבקש פוסט לבלוג → מנהל מפעיל Blog Post Workflow → בשעה ה-AI גומר: Research + Outline + Writing + Editing + SEO → לקוח מקבל לינק לאישור → לחיצה → פוסט מוכן לפרסום.

**בלי AI**: 4-8 שעות עבודה. **עם המערכת**: 15-30 דקות AI + 5 דקות אישור.

### Use Case 2: SEO Agency

הכנס דומיין → הפעל SEO Audit Workflow → קבל דוח מלא עם recommendations → שלח ללקוח לאישור.

### Use Case 3: פיתוח מוצר

הפעל PlannerAgent על רעיון → קבל breakdown מלא: milestones, tasks, תלויות, estimation.

### Use Case 4: מרקטינג

הכנס campaign brief → Social Media Campaign Workflow → קבל: posts ל-LinkedIn, Twitter, Instagram + email sequence + landing page copy.

### Use Case 5: White Label SaaS

המערכת מוכנה לריבוי לקוחות (RLS מבדיל בין לקוחות). כל לקוח רואה רק את הפרויקטים שלו. Custom workflows לכל לקוח. API keys נפרדים.

---

## מצב נוכחי

### עובד

```
npm run dev      → Next.js עולה, כל הדפים 200
/api/health      → {"status":"ok"}
/api/ollama      → זיהוי + הוראות התקנה
DB               → כל הטבלאות, 6 workflows, RLS
claim_next_ai_job → RPC עובד עם service role
```

### חסר להשלמה מלאה

| מה חסר | השפעה | איך לפתור |
|---------|--------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` (JWT אמיתי) | Worker לא כותב ל-DB, API routes לא עובדות | Dashboard → Project Settings → API → service_role → [Reveal] |
| מפתח AI אחד לפחות | Worker לא מריץ jobs | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `XAI_API_KEY` |

### דו"ח בריאות מלא

```
Component                Status    Notes
─────────────────────────────────────────────────────
Next.js Dev Server       OK        port 3000
Supabase DB              OK        latency ~15ms
/api/health              OK
/dashboard               OK        200
/ai-logs                 OK        200
/deliverables            OK        200
/api/ollama              OK        (not_installed → shows install guide)
/api/workflows/start     NEEDS     service_role key
/api/approvals/[id]      NEEDS     service_role key
Worker                   NEEDS     service_role + AI provider key
AI Job Execution         NEEDS     AI provider key
Ollama (local)           OPTIONAL  not installed
```

---

## איך ממשיכים מפה

### שלב 1 — הפעלה מלאה (15 דקות)

```bash
# 1. קבל service_role key:
#    Supabase Dashboard → Project Settings → API → service_role → [Reveal]

# 2. ערוך .env.local:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...   # או כל provider אחר

# 3. הפעל שניהם:
npm run dev       # טרמינל 1
npm run worker    # טרמינל 2

# 4. בדוק:
curl http://localhost:3000/api/health
```

### שלב 2 — הרץ Workflow ראשון

```bash
npx tsx examples/blog-post-workflow.ts
```

או ידנית דרך API:

```bash
curl -X POST http://localhost:3000/api/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "UUID_של_ה_TASK",
    "workflowId": "fb8cf12f-e764-4b6e-8fd1-3d46f3838357"
  }'
```

### שלב 3 — הוסף Agent מותאם

```typescript
// src/lib/agents/translator-agent.ts
import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

class TranslatorAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return `You are a professional translator.
Respond with valid JSON: {"translation": "...", "language": "..."}`;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const { text, targetLanguage } = input.inputData as { text: string; targetLanguage: string };
    return `Translate to ${targetLanguage}:\n\n${text}`;
  }

  protected getFallbackOutput() {
    return { translation: '', language: '' };
  }
}

registerAgent('TranslatorAgent', TranslatorAgent);
```

```typescript
// src/lib/agents/index.ts — הוסף:
import './translator-agent';
```

### שלב 4 — צור Workflow מותאם

הוסף ל-`scripts/seed-workflows.ts` ואז `npm run db:seed`:

```typescript
{
  name: 'Translation Workflow',
  task_type: 'other',
  definition: {
    name: 'Translation Workflow',
    steps: [
      {
        name: 'translate',
        type: 'ai',
        agent: 'TranslatorAgent',
        config: { provider: 'anthropic', model: 'claude-sonnet-4-6' }
      },
      { name: 'approval', type: 'wait_for_approval' },
      { name: 'publish',  type: 'publish' }
    ]
  }
}
```

### שלב 5 — Deploy לייצור

```bash
# Option A: Vercel + Railway (מומלץ)
vercel deploy          # frontend
railway up             # worker

# Option B: Docker
docker-compose up -d

# Option C: Vercel + Render
# ב-Render: New Background Worker → npm run worker:prod
```

---

## Setup מהיר

```bash
git clone <repo>
cd ai-client-dashboard
npm install

cp .env.example .env.local
# ערוך .env.local

npm run dev        # http://localhost:3000
npm run worker     # טרמינל שני
```

### משתני סביבה

```bash
# =====================================================
# חובה
# =====================================================
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # JWT עם role:service_role
DATABASE_URL=postgresql://...

# =====================================================
# AI Provider — לפחות אחד
# =====================================================
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
XAI_API_KEY=xai-...
OLLAMA_BASE_URL=http://localhost:11434  # לאחר התקנת Ollama

# =====================================================
# Worker (אופציונלי — ברירות מחדל טובות)
# =====================================================
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_CONCURRENT_JOBS=3
WORKER_JOB_TIMEOUT_MS=300000
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o-mini
```

---

## מבנה הפרויקט

```
ai-client-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/login/       # Login page
│   │   ├── admin/projects/     # Admin panel
│   │   ├── ai-logs/            # AI execution logs
│   │   ├── api/
│   │   │   ├── health/         # GET  /api/health
│   │   │   ├── workflows/start/# POST /api/workflows/start
│   │   │   ├── approvals/[id]/ # PATCH /api/approvals/[id]
│   │   │   └── ollama/         # GET/POST /api/ollama
│   │   ├── dashboard/
│   │   ├── deliverables/
│   │   ├── projects/[id]/
│   │   └── tasks/[id]/
│   │
│   ├── components/
│   │   ├── ui/                 # Button, Card, Badge, Avatar, Progress
│   │   ├── dashboard-layout.tsx
│   │   └── ollama-manager.tsx
│   │
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-projects.ts
│   │   ├── use-tasks.ts
│   │   ├── use-realtime.ts
│   │   ├── use-task-realtime.ts
│   │   └── use-notifications.ts
│   │
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── base-agent.ts   # Abstract base (provider abstraction)
│   │   │   ├── research-agent.ts
│   │   │   ├── writer-agent.ts
│   │   │   ├── editor-agent.ts
│   │   │   ├── seo-agent.ts
│   │   │   └── planner-agent.ts
│   │   ├── llm/
│   │   │   ├── ollama.ts       # Ollama HTTP client + manager
│   │   │   ├── validation.ts   # Zod schemas per agent
│   │   │   ├── json-parser.ts
│   │   │   └── failure-classification.ts
│   │   ├── workflows/
│   │   │   ├── workflow-engine.ts
│   │   │   └── default-workflows.ts
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── database.types.ts
│   │
│   └── types/index.ts
│
├── workers/
│   └── job-worker.ts           # Background worker
│
├── scripts/
│   └── seed-workflows.ts
│
├── examples/
│   └── blog-post-workflow.ts
│
├── config/
│   ├── schema.sql
│   └── migrations/
│       ├── 001_add_next_run_at.sql
│       └── 002_align_schema.sql
│
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.worker
├── vercel.json
└── ecosystem.config.js
```

---

## AI Agents

### BaseAgent — API

```typescript
interface AgentConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'xai' | 'ollama';
  model: string;
  systemPrompt: string;
  temperature?: number;   // default: 0.7
  maxTokens?: number;     // default: 4096
  timeoutMs?: number;     // default: 120000
}
```

### יצירת Agent חדש — 3 שלבים

```typescript
// 1. צור src/lib/agents/my-agent.ts
class MyAgent extends BaseAgent {
  protected getDefaultSystemPrompt() {
    return 'You are a specialist. Respond with JSON: {"result": "..."}';
  }
  protected async buildUserPrompt(input: AgentInput) {
    return `Task: ${JSON.stringify(input.inputData)}`;
  }
  protected getFallbackOutput() {
    return { result: '' };
  }
}
registerAgent('MyAgent', MyAgent);

// 2. import ב-src/lib/agents/index.ts
import './my-agent';

// 3. השתמש ב-workflow definition
{ "agent": "MyAgent", "type": "ai", ... }
```

---

## Workflows

### מבנה Workflow Definition

```json
{
  "name": "My Workflow",
  "steps": [
    {
      "name": "research",
      "type": "ai",
      "agent": "ResearchAgent",
      "config": {
        "provider": "openai",
        "model": "gpt-4o",
        "input": { "depth": "comprehensive" }
      },
      "retry_count": 3,
      "timeout_seconds": 300
    },
    {
      "name": "client_review",
      "type": "wait_for_approval",
      "timeout_seconds": 604800
    },
    {
      "name": "publish",
      "type": "publish"
    }
  ]
}
```

### Context Passing — כל Step מקבל outputs של הקודמים

```
Step 1 (research) output: { findings: "..." }
Step 2 (writing)  input:  { findings: "...", topic: "..." }   ← merged
Step 3 (editing)  input:  { findings: "...", draft: "...", topic: "..." }
```

---

## LLM Providers

### הגדרת provider ב-workflow

```json
{ "config": { "provider": "anthropic", "model": "claude-sonnet-4-6" } }
```

### ברירת מחדל (env)

```bash
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-4o-mini
```

---

## Ollama — מודלים מקומיים

### למה Ollama?

- **חינמי** — אין עלות per-token
- **פרטי** — הנתונים לא יוצאים מהשרת
- **מהיר** — ב-hardware טוב מנצח GPT-4o-mini

### התקנה

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh && ollama serve

# macOS
brew install ollama && ollama serve

# Windows: https://ollama.com/download/windows
```

### מודלים מומלצים

| מודל | גודל | שימוש |
|------|------|-------|
| `llama3.2` | 2 GB | כתיבה כללית |
| `mistral` | 4 GB | ניתוח + כתיבה |
| `gemma3:4b` | 3 GB | Google model |
| `deepseek-r1:7b` | 4 GB | reasoning |
| `nomic-embed-text` | 274 MB | embeddings |

### UI לניהול

```tsx
import { OllamaManager } from '@/components/ollama-manager';

export default function SettingsPage() {
  return <OllamaManager />;
}
```

---

## Database Schema

### טבלאות ראשיות

```
projects          — פרויקטי לקוחות
tasks             — משימות (input_data, output_data)
ai_jobs           — כל ה-AI executions (status, logs, token_usage)
workflows         — הגדרות workflow (JSON definition)
workflow_executions       — הרצות פעילות
workflow_step_executions  — מעקב ברמת step
approvals         — בקשות אישור
deliverables      — תוצרים סופיים
```

### RPC Functions

```sql
-- Claim next job (atomic, row-level lock — אין כפל)
SELECT * FROM claim_next_ai_job('worker-01');

-- Reap stuck jobs
SELECT * FROM reap_stuck_jobs(timeout_minutes := 30);
```

---

## API Reference

### POST `/api/workflows/start`

```json
// Request
{ "taskId": "uuid", "workflowId": "uuid" }

// Response
{ "executionId": "uuid", "firstJobId": "uuid", "steps": 7 }
```

### PATCH `/api/approvals/[id]`

```json
// Request
{ "status": "approved", "notes": "looks great!" }
// status: "approved" | "rejected" | "revision_requested"
```

### GET `/api/ollama`

```json
{
  "status": "running",
  "version": "0.6.1",
  "models": [{ "name": "llama3.2", "size": 2019377162, ... }],
  "modelCount": 1
}
```

### POST `/api/ollama`

```json
{ "action": "pull",   "model": "llama3.2" }  // NDJSON stream
{ "action": "delete", "model": "llama3.2" }
{ "action": "info",   "model": "llama3.2" }
```

---

## Background Worker

### הפעלה

```bash
npm run worker         # dev
npm run worker:prod    # prod
pm2 start ecosystem.config.js
docker-compose up worker
```

### מחזור חיים

```
queued → running → completed
              ↓
         failed (attempts >= max_attempts)
              ↓
         queued (retry עם backoff אם attempts < max_attempts)
```

### Exponential Backoff

```
ניסיון 1: 1 שנייה + jitter
ניסיון 2: 2 שניות + jitter
ניסיון 3: 4 שניות + jitter
לאחר מכן: failed סופי
```

### הגדרות

```bash
WORKER_POLL_INTERVAL_MS=5000        # כל 5 שניות
WORKER_MAX_CONCURRENT_JOBS=3        # עד 3 במקביל
WORKER_JOB_TIMEOUT_MS=300000        # 5 דקות timeout
WORKER_STUCK_JOB_TIMEOUT_MINUTES=30 # reap אחרי 30 דקות
```

---

## Deployment

### Option A: Vercel + Railway (מומלץ)

```bash
vercel deploy    # frontend
railway up       # worker
```

### Option B: Docker Compose

```bash
docker-compose up -d
# web: port 3000, worker: background
```

### Option C: Vercel + Render

1. `vercel deploy`
2. ב-Render: New Background Worker → `npm run worker:prod`

---

## Roadmap

### קצר טווח

- [ ] Client Portal — דף נפרד ללקוח
- [ ] Email Notifications — כש-step מסתיים
- [ ] Custom Workflow Builder — UI לבניית workflows
- [ ] Cost Tracking — עלויות per-job

### בינוני טווח

- [ ] ToolAgent — Agent שגולש ומחפש באינטרנט
- [ ] RAG Agent — חיפוש ב-knowledge base פנימי
- [ ] Streaming UI — תוצאות בזמן אמת
- [ ] Webhook Support

### ארוך טווח

- [ ] Multi-tenant subdomains
- [ ] Analytics Dashboard
- [ ] A/B Testing providers
- [ ] Auto-scaling Worker

---

## Troubleshooting

### Worker לא מריץ jobs

`SUPABASE_SERVICE_ROLE_KEY` הוא publishable key ולא JWT של service_role.
פתרון: Supabase Dashboard → Project Settings → API → service_role → [Reveal]

### "Task not found" ב-API

אותה בעיה — RLS חוסם כי המפתח הוא anon ולא service_role.

### Ollama לא זוהה

```bash
curl http://localhost:11434/api/version  # בדוק
ollama serve                             # הפעל
```

### Job נתקע ב-running

```sql
-- ב-Supabase SQL Editor:
SELECT * FROM reap_stuck_jobs(timeout_minutes := 5);
```

---

## Scripts

```bash
npm run dev           # Next.js dev server
npm run build         # Production build
npm run start         # Production server
npm run worker        # Background worker (dev)
npm run worker:prod   # Background worker (prod)
npm run db:seed       # Seed 6 default workflows
npm run db:migrate    # Run migrations
npm run lint          # ESLint
```

---

## מסמכים נוספים

- [`DEVELOPERS.md`](./DEVELOPERS.md) — מדריך מפתחים: agents, workflows, patterns
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel, Docker, AWS, GCP, K8s
- [`BUILD_SUMMARY.md`](./BUILD_SUMMARY.md) — סיכום build
- [`examples/blog-post-workflow.ts`](./examples/blog-post-workflow.ts) — דוגמה מלאה

---

*Built with Next.js 14 · Supabase · Vercel AI SDK · TypeScript*
