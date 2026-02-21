# Developer Guide

## Table of Contents

1. [Adding a New AI Agent](#adding-a-new-ai-agent)
2. [Creating Custom Workflows](#creating-custom-workflows)
3. [Database Operations](#database-operations)
4. [API Reference](#api-reference)
5. [Best Practices](#best-practices)

---

## Adding a New AI Agent

### Step 1: Create Agent Class

Create a new file in `src/lib/agents/`:

```typescript
// src/lib/agents/video-agent.ts
import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const VIDEO_SYSTEM_PROMPT = `You are a Video Content Agent specialized in creating video scripts and descriptions.

Your responsibilities:
1. Write engaging video scripts
2. Create video descriptions and titles
3. Suggest visual elements and transitions
4. Optimize for platform requirements (YouTube, TikTok, etc.)

Always provide output as valid JSON:
{
  "title": "Video title",
  "script": "Full video script",
  "description": "Video description",
  "tags": ["tag1", "tag2"],
  "thumbnailIdea": "Description of thumbnail",
  "duration": "Estimated duration"
}`;

export class VideoAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return VIDEO_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const {
      topic,
      platform = 'youtube',
      duration = 'medium',
      style = 'educational',
      targetAudience,
    } = input.inputData;

    let prompt = `Create a video with these specifications:\n\n`;
    prompt += `Topic: ${topic}\n`;
    prompt += `Platform: ${platform}\n`;
    prompt += `Duration: ${duration}\n`;
    prompt += `Style: ${style}\n`;

    if (targetAudience) {
      prompt += `Target Audience: ${targetAudience}\n`;
    }

    if (input.context?.brandGuidelines) {
      prompt += `\nBrand Guidelines:\n${input.context.brandGuidelines}`;
    }

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.topic) {
      throw new Error('Video topic is required');
    }
  }

  protected getFallbackOutput(): Record<string, unknown> {
    return {
      title: 'Video Title',
      script: 'Video script content...',
      description: 'Video description',
      tags: ['video'],
      thumbnailIdea: 'Thumbnail concept',
      duration: '5 minutes',
    };
  }
}

// Register the agent
registerAgent('VideoAgent', VideoAgent);
```

### Step 2: Add Zod Schema (Optional but Recommended)

```typescript
// src/lib/llm/validation.ts (add to existing file)

export const videoOutputSchema = z.object({
  title: z.string().min(1),
  script: z.string().min(100),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailIdea: z.string(),
  duration: z.string(),
});

export type VideoOutput = z.infer<typeof videoOutputSchema>;

// Add to agentSchemaMap
export const agentSchemaMap: Record<string, z.ZodType> = {
  // ... existing agents
  VideoAgent: videoOutputSchema,
};
```

### Step 3: Import Agent in Index

```typescript
// src/lib/agents/index.ts (add to existing file)
import './video-agent';

export { VideoAgent } from './video-agent';
```

### Step 4: Use in Workflow

```typescript
// In your workflow definition
{
  name: 'video_script',
  agent: 'VideoAgent',
  type: 'ai',
  config: {
    provider: 'openai',
    model: 'gpt-4o',
  },
}
```

---

## Creating Custom Workflows

### Workflow Definition Structure

```typescript
import type { WorkflowDefinition } from '@/types';

export const customWorkflow: WorkflowDefinition = {
  name: 'Custom Workflow Name',
  description: 'Description of what this workflow does',
  steps: [
    // Step 1: AI Agent
    {
      name: 'research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
      },
    },
    // Step 2: Another AI Agent
    {
      name: 'content_creation',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 600,
      retry_count: 2,
      config: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      },
    },
    // Step 3: Wait for Approval
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 604800, // 7 days
    },
    // Step 4: Publish
    {
      name: 'publish',
      type: 'publish',
    },
  ],
};
```

### Step Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `ai` | Execute an AI agent | `agent` |
| `wait_for_approval` | Pause for client approval | - |
| `publish` | Mark task as complete | - |
| `custom` | Custom logic (extend in code) | - |

### Conditional Execution

```typescript
{
  name: 'seo_optimization',
  agent: 'SeoAgent',
  type: 'ai',
  // Only run if content type is 'blog_post'
  condition: '${task_data.contentType} === "blog_post"',
}
```

### Saving Workflow to Database

```typescript
import { workflowManager } from '@/lib/workflows/workflow-engine';

await workflowManager.createWorkflow(
  'my-custom-workflow',
  'blog_post',
  customWorkflow,
  'Optional description'
);
```

---

## Database Operations

### Creating a Project

```typescript
import { createServerClient } from '@/lib/supabase/client';

const supabase = createServerClient(undefined, true);

const { data: project, error } = await supabase
  .from('projects')
  .insert({
    client_id: 'client-uuid',
    name: 'Project Name',
    description: 'Description',
    status: 'active',
    deadline: '2024-12-31',
    budget: 5000,
  })
  .select()
  .single();
```

### Creating a Task

```typescript
const { data: task } = await supabase
  .from('tasks')
  .insert({
    project_id: 'project-uuid',
    name: 'Task Name',
    type: 'blog_post',
    status: 'pending',
    priority: 8,
    assigned_agent: 'WriterAgent',
    input_data: {
      topic: 'AI Trends',
      keywords: ['AI', 'trends'],
    },
  })
  .select()
  .single();
```

### Triggering AI Job Manually

```typescript
await supabase
  .from('ai_jobs')
  .insert({
    task_id: 'task-uuid',
    agent_name: 'WriterAgent',
    model: 'gpt-4o',
    provider: 'openai',
    status: 'queued',
    prompt: 'Write a blog post about...',
    input_data: { topic: 'AI Trends' },
  });
```

### Responding to Approval (Client)

```typescript
// Update approval
await supabase
  .from('approvals')
  .update({
    status: 'approved', // or 'rejected' or 'revision_requested'
    response_notes: 'Looks great!',
    responded_at: new Date().toISOString(),
  })
  .eq('task_id', 'task-uuid')
  .eq('status', 'pending');

// Update task status
await supabase
  .from('tasks')
  .update({ 
    status: 'completed' // or 'running' for revisions
  })
  .eq('id', 'task-uuid');
```

---

## API Reference

### Supabase RPC Functions

#### `claim_next_ai_job()`

Claims the next available job with row-level locking.

```sql
SELECT * FROM claim_next_ai_job();
```

Returns: `ai_jobs` row or empty if no jobs available.

#### `reap_stuck_jobs(timeout_minutes)`

Returns stuck jobs to queued status.

```sql
SELECT * FROM reap_stuck_jobs(30);
```

#### `get_dashboard_stats(user_id)`

Get dashboard statistics.

```sql
SELECT get_dashboard_stats('user-uuid');
```

Returns JSONB with stats.

---

## Best Practices

### 1. Agent Development

- **Always validate input** in `validateInput()`
- **Provide fallback output** in `getFallbackOutput()`
- **Use Zod schemas** for output validation
- **Log important steps** with `this.log()`
- **Handle errors gracefully** - never throw unless critical

### 2. Workflow Design

- **Keep steps atomic** - each step should do one thing
- **Set appropriate timeouts** - don't let jobs hang forever
- **Use approval gates** for client sign-off points
- **Add retry logic** for flaky operations

### 3. Error Handling

```typescript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  log('error', 'Operation failed', { error: String(error) });
  return { 
    success: false, 
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

### 4. Performance

- **Use database indexes** for frequently queried columns
- **Batch operations** when possible
- **Implement caching** for expensive operations
- **Monitor worker concurrency** - don't overwhelm AI APIs

### 5. Security

- **Never expose service role key** to client
- **Validate all user input** server-side
- **Use RLS policies** - don't rely on application logic alone
- **Sanitize LLM output** before storing/displaying

### 6. Testing

```typescript
// Example agent test
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '@/lib/agents/writer-agent';

describe('WriterAgent', () => {
  it('should generate valid output', async () => {
    const agent = new WriterAgent({
      name: 'WriterAgent',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'Test prompt',
    });

    const output = await agent.execute({
      taskId: 'test-1',
      inputData: { topic: 'Test', contentType: 'blog_post' },
    });

    expect(output.success).toBe(true);
    expect(output.data).toHaveProperty('content');
  });
});
```

---

## Troubleshooting

### Agent Not Executing

1. Check if agent is registered: `getAvailableAgents()`
2. Verify environment variables for provider
3. Check worker logs for errors

### Workflow Stuck

1. Check `workflow_executions` table for current step
2. Verify `workflow_step_executions` for errors
3. Look for pending approvals

### Jobs Not Processing

1. Ensure worker is running: `npm run worker`
2. Check `claim_next_ai_job()` RPC is available
3. Verify Supabase connection in worker

### JSON Parsing Failing

1. Check raw output in `ai_jobs.logs`
2. Verify agent system prompt requests JSON
3. Add more specific schema validation

---

## Examples

See the `examples/` directory for complete working examples:

- `blog-post-workflow.ts` - Full blog post creation flow
- More examples coming soon

---

## Support

For issues or questions:
1. Check this documentation
2. Review inline code comments
3. Check application logs
4. Verify database state in Supabase dashboard
