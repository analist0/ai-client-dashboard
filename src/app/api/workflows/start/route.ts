/**
 * Start Workflow Endpoint
 * POST /api/workflows/start
 *
 * Body: { taskId: string, workflowId: string }
 *
 * Creates a workflow_executions record, then queues the first ai_job.
 * The worker picks it up and advances the workflow step-by-step.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/client';

async function requireAdmin(
  req: NextRequest
): Promise<{ id: string; supabase: ReturnType<typeof createAdminClient> } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? { id: user.id, supabase } : null;
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { taskId, workflowId } = body as { taskId?: string; workflowId?: string };

    if (!taskId || !workflowId) {
      return NextResponse.json(
        { error: 'taskId and workflowId are required' },
        { status: 400 }
      );
    }

    const supabase = caller.supabase;

    // Load task
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, input_data, status')
      .eq('id', taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Load workflow
    const { data: workflow, error: wfErr } = await supabase
      .from('workflows')
      .select('id, definition')
      .eq('id', workflowId)
      .eq('is_active', true)
      .single();

    if (wfErr || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const steps = (workflow.definition as { steps: Record<string, unknown>[] }).steps;
    if (!steps?.length) {
      return NextResponse.json({ error: 'Workflow has no steps' }, { status: 400 });
    }

    // Create workflow execution
    const { data: execution, error: execErr } = await supabase
      .from('workflow_executions')
      .insert({
        task_id: taskId,
        workflow_id: workflowId,
        status: 'running',
        current_step: 0,
        total_steps: steps.length,
        context: {},
      })
      .select('id')
      .single();

    if (execErr || !execution) {
      return NextResponse.json(
        { error: 'Failed to create workflow execution' },
        { status: 500 }
      );
    }

    // Process first step
    const firstStep = steps[0] as {
      name: string;
      type: string;
      agent?: string;
      retry_count?: number;
      config?: { model?: string; provider?: string; input?: Record<string, unknown> };
    };

    const inputData: Record<string, unknown> = {
      ...(task.input_data as Record<string, unknown> || {}),
      ...(firstStep.config?.input || {}),
    };

    if (firstStep.type === 'wait_for_approval') {
      // First step is an approval gate — create approval record immediately
      await supabase.from('approvals').insert({
        task_id: taskId,
        status: 'pending',
        metadata: { step_name: firstStep.name, step_index: 0, execution_id: execution.id },
      });
      await supabase.from('workflow_step_executions').insert({
        execution_id: execution.id,
        step_index: 0,
        step_name: firstStep.name,
        status: 'pending',
        started_at: new Date().toISOString(),
      });
      await supabase.from('tasks').update({ status: 'waiting_approval' }).eq('id', taskId);

      return NextResponse.json({
        executionId: execution.id,
        status: 'waiting_approval',
        message: 'Workflow started, waiting for approval on first step',
      });
    }

    if (firstStep.type === 'ai' && firstStep.agent) {
      // Create step execution record
      const { data: stepExec } = await supabase
        .from('workflow_step_executions')
        .insert({
          execution_id: execution.id,
          step_index: 0,
          step_name: firstStep.name,
          agent_name: firstStep.agent,
          status: 'pending',
          input_data: inputData,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // Queue the first ai_job
      const { data: job, error: jobErr } = await supabase
        .from('ai_jobs')
        .insert({
          task_id: taskId,
          agent_name: firstStep.agent,
          model:
            firstStep.config?.model ||
            process.env.DEFAULT_LLM_MODEL ||
            'gpt-4o-mini',
          provider:
            firstStep.config?.provider ||
            process.env.DEFAULT_LLM_PROVIDER ||
            'openai',
          status: 'queued',
          prompt: JSON.stringify({ workflow_step: firstStep.name, task_id: taskId }),
          input_data: inputData,
          max_retries: firstStep.retry_count ?? 3,
        })
        .select('id')
        .single();

      if (jobErr || !job) {
        return NextResponse.json(
          { error: 'Failed to queue first job' },
          { status: 500 }
        );
      }

      // Link step execution to job
      if (stepExec) {
        await supabase
          .from('workflow_step_executions')
          .update({ ai_job_id: job.id })
          .eq('id', stepExec.id);
      }

      // Update task status to running
      await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId);

      return NextResponse.json({
        executionId: execution.id,
        firstJobId: job.id,
        status: 'running',
        message: `Workflow started. First step: ${firstStep.name} (${firstStep.agent})`,
      });
    }

    return NextResponse.json(
      { error: `Unsupported first step type: ${firstStep.type}` },
      { status: 400 }
    );
  } catch (err) {
    console.error('[workflows/start] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
