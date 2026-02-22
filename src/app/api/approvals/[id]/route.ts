/**
 * Approval Response Endpoint
 * PATCH /api/approvals/[id]
 *
 * Body: { status: 'approved' | 'rejected' | 'revision_requested', notes?: string }
 *
 * - Updates the approval record
 * - Resumes the workflow (queues next step) or fails it
 * - Client never sees prompts or secrets — response contains only status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/client';

type ApprovalStatus = 'approved' | 'rejected' | 'revision_requested';

const VALID_STATUSES: ApprovalStatus[] = ['approved', 'rejected', 'revision_requested'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const approvalId = params.id;
    const body = await req.json();
    const { status, notes } = body as { status?: ApprovalStatus; notes?: string };

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;

    // Load approval
    const { data: approvalRaw, error: approvalErr } = await supabase
      .from('approvals')
      .select('id, task_id, status, metadata')
      .eq('id', approvalId)
      .single();

    if (approvalErr || !approvalRaw) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    const approval = approvalRaw as {
      id: string;
      task_id: string;
      status: string;
      metadata: Record<string, unknown> | null;
    };

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Approval already responded (status: ${approval.status})` },
        { status: 409 }
      );
    }

    // Update approval record
    await supabase
      .from('approvals')
      .update({
        status,
        response_notes: notes ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    const taskId = approval.task_id;
    const meta = approval.metadata as { step_index?: number; execution_id?: string } | null;

    // ── Rejected: fail the workflow ────────────────────────────
    if (status === 'rejected') {
      await supabase.from('tasks').update({ status: 'failed' }).eq('id', taskId);

      if (meta?.execution_id) {
        await supabase
          .from('workflow_executions')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', meta.execution_id);

        if (meta.step_index !== undefined) {
          await supabase
            .from('workflow_step_executions')
            .update({
              status: 'failed',
              error_message: 'Rejected by client',
              completed_at: new Date().toISOString(),
            })
            .eq('execution_id', meta.execution_id)
            .eq('step_index', meta.step_index);
        }
      }

      return NextResponse.json({ taskId, status: 'failed', message: 'Workflow rejected' });
    }

    // ── Revision requested: reset task to running ──────────────
    if (status === 'revision_requested') {
      await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId);
      return NextResponse.json({
        taskId,
        status: 'revision_requested',
        message: 'Revision requested — task reset to running',
      });
    }

    // ── Approved: advance workflow ─────────────────────────────
    if (!meta?.execution_id || meta.step_index === undefined) {
      // No workflow context — just mark task as running
      await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId);
      return NextResponse.json({ taskId, status: 'approved', message: 'Approved' });
    }

    const executionId = meta.execution_id;
    const approvalStepIndex = meta.step_index;

    // Mark the approval step_execution as completed
    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'completed',
        output_data: { approved: true, approved_at: new Date().toISOString() },
        completed_at: new Date().toISOString(),
      })
      .eq('execution_id', executionId)
      .eq('step_index', approvalStepIndex);

    // Load workflow execution
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('id, workflow_id, total_steps, current_step')
      .eq('id', executionId)
      .single();

    if (!execution) {
      return NextResponse.json({ error: 'Workflow execution not found' }, { status: 404 });
    }

    const nextStepIndex = approvalStepIndex + 1;

    // Advance current_step
    await supabase
      .from('workflow_executions')
      .update({ current_step: nextStepIndex })
      .eq('id', executionId);

    // All steps done
    if (nextStepIndex >= (execution.total_steps as number)) {
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', executionId);
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      return NextResponse.json({ taskId, status: 'completed', message: 'Workflow completed' });
    }

    // Load next step from workflow definition
    const { data: workflow } = await supabase
      .from('workflows')
      .select('definition')
      .eq('id', execution.workflow_id as string)
      .single();

    const steps = (workflow?.definition as { steps: Record<string, unknown>[] })?.steps || [];
    const nextStep = steps[nextStepIndex] as {
      name: string;
      type: string;
      agent?: string;
      retry_count?: number;
      config?: { model?: string; provider?: string; input?: Record<string, unknown> };
    } | undefined;

    if (!nextStep) {
      return NextResponse.json({ error: 'Next step definition not found' }, { status: 500 });
    }

    // Publish step → complete
    if (nextStep.type === 'publish') {
      await supabase
        .from('workflow_step_executions')
        .insert({
          execution_id: executionId,
          step_index: nextStepIndex,
          step_name: nextStep.name,
          status: 'completed',
          output_data: { published: true },
          completed_at: new Date().toISOString(),
        });
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', current_step: nextStepIndex + 1, completed_at: new Date().toISOString() })
        .eq('id', executionId);
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);

      return NextResponse.json({ taskId, status: 'completed', message: 'Published and completed' });
    }

    // AI step → queue next job
    if (nextStep.type === 'ai' && nextStep.agent) {
      const { data: task } = await supabase
        .from('tasks')
        .select('input_data')
        .eq('id', taskId)
        .single();

      const { data: doneSteps } = await supabase
        .from('workflow_step_executions')
        .select('step_name, output_data')
        .eq('execution_id', executionId)
        .eq('status', 'completed')
        .order('step_index', { ascending: true });

      const prevOutputs = (doneSteps || []).reduce(
        (acc: Record<string, unknown>, s: { step_name: string; output_data: unknown }) => {
          if (s.output_data) acc[s.step_name] = s.output_data;
          return acc;
        },
        {} as Record<string, unknown>
      );

      const inputData: Record<string, unknown> = {
        ...(task?.input_data as Record<string, unknown> || {}),
        ...prevOutputs,
        ...(nextStep.config?.input || {}),
      };

      const { data: stepExec } = await supabase
        .from('workflow_step_executions')
        .insert({
          execution_id: executionId,
          step_index: nextStepIndex,
          step_name: nextStep.name,
          agent_name: nextStep.agent,
          status: 'pending',
          input_data: inputData,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      const { data: newJob, error: jobErr } = await supabase
        .from('ai_jobs')
        .insert({
          task_id: taskId,
          agent_name: nextStep.agent,
          model: nextStep.config?.model || process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
          provider: nextStep.config?.provider || process.env.DEFAULT_LLM_PROVIDER || 'openai',
          status: 'queued',
          prompt: JSON.stringify({ workflow_step: nextStep.name, task_id: taskId }),
          input_data: inputData,
          max_retries: nextStep.retry_count ?? 3,
        })
        .select('id')
        .single();

      if (jobErr || !newJob) {
        return NextResponse.json(
          { error: `Failed to queue next job: ${jobErr?.message}` },
          { status: 500 }
        );
      }

      if (stepExec) {
        await supabase
          .from('workflow_step_executions')
          .update({ ai_job_id: newJob.id })
          .eq('id', stepExec.id as string);
      }

      await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId);

      return NextResponse.json({
        taskId,
        status: 'running',
        nextJobId: newJob.id,
        message: `Approved. Queued next step: ${nextStep.name}`,
      });
    }

    // Another approval gate
    if (nextStep.type === 'wait_for_approval') {
      await supabase.from('approvals').insert({
        task_id: taskId,
        status: 'pending',
        metadata: { step_name: nextStep.name, step_index: nextStepIndex, execution_id: executionId },
      });
      await supabase
        .from('workflow_step_executions')
        .insert({
          execution_id: executionId,
          step_index: nextStepIndex,
          step_name: nextStep.name,
          status: 'pending',
          started_at: new Date().toISOString(),
        });
      await supabase.from('tasks').update({ status: 'waiting_approval' }).eq('id', taskId);

      return NextResponse.json({
        taskId,
        status: 'waiting_approval',
        message: `Approved. Next step requires another approval: ${nextStep.name}`,
      });
    }

    return NextResponse.json({ taskId, status: 'approved', message: 'Approved' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
