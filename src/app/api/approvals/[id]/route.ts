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

async function getAuthenticatedUser(
  req: NextRequest
): Promise<{ id: string; role: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!data) return null;
  return { id: user.id, role: data.role as string };
}

type ApprovalStatus = 'approved' | 'rejected' | 'revision_requested';

const VALID_STATUSES: ApprovalStatus[] = ['approved', 'rejected', 'revision_requested'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
      }
      if (notes.length > 2000) {
        return NextResponse.json({ error: 'notes must be 2000 characters or fewer' }, { status: 400 });
      }
    }

    const supabase = createAdminClient();

    // Load approval
    const { data: approval, error: approvalErr } = await supabase
      .from('approvals')
      .select('id, task_id, status, metadata')
      .eq('id', approvalId)
      .single();

    if (approvalErr || !approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // Authorisation: admin can respond to any approval;
    // a client can only respond to approvals for tasks they own.
    if (caller.role !== 'admin') {
      const taskId = approval.task_id as string;
      const { data: task } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();
      const { data: project } = task
        ? await supabase.from('projects').select('client_id').eq('id', task.project_id as string).single()
        : { data: null };
      const { data: client } = project
        ? await supabase.from('clients').select('user_id').eq('id', project.client_id as string).single()
        : { data: null };
      if (client?.user_id !== caller.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Approval already responded (status: ${approval.status})` },
        { status: 409 }
      );
    }

    // Update approval record first; all subsequent writes are wrapped so we
    // can compensate (revert) the approval if the workflow advancement fails.
    const { error: approvalUpdateErr } = await supabase
      .from('approvals')
      .update({
        status,
        response_notes: notes ?? null,
        responded_at: new Date().toISOString(),
        responded_by: caller.id,
      })
      .eq('id', approvalId);

    if (approvalUpdateErr) {
      return NextResponse.json({ error: 'Failed to record response' }, { status: 500 });
    }

    // Helper: revert the approval to pending if downstream writes fail
    const revertApproval = () =>
      supabase
        .from('approvals')
        .update({ status: 'pending', responded_at: null, responded_by: null, response_notes: null })
        .eq('id', approvalId);

    const taskId = approval.task_id as string;
    const meta = approval.metadata as {
      step_index?: number;
      execution_id?: string;
    } | null;

    // ── Rejected: fail the workflow ────────────────────────────
    if (status === 'rejected') {
      const { error: taskErr } = await supabase
        .from('tasks')
        .update({ status: 'failed' })
        .eq('id', taskId);
      if (taskErr) {
        await revertApproval();
        return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
      }

      if (meta?.execution_id) {
        try {
          await supabase
            .from('workflow_executions')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', meta.execution_id)
            .throwOnError();

          if (meta.step_index !== undefined) {
            await supabase
              .from('workflow_step_executions')
              .update({
                status: 'failed',
                error_message: 'Rejected by client',
                completed_at: new Date().toISOString(),
              })
              .eq('execution_id', meta.execution_id)
              .eq('step_index', meta.step_index)
              .throwOnError();
          }
        } catch {
          await revertApproval();
          await supabase.from('tasks').update({ status: 'waiting_approval' }).eq('id', taskId);
          return NextResponse.json({ error: 'Failed to update workflow status' }, { status: 500 });
        }
      }

      return NextResponse.json({ taskId, status: 'failed', message: 'Workflow rejected' });
    }

    // ── Revision requested: re-queue previous AI step ─────────
    if (status === 'revision_requested') {
      const { error: taskErr } = await supabase
        .from('tasks')
        .update({ status: 'running' })
        .eq('id', taskId);
      if (taskErr) {
        await revertApproval();
        return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
      }

      // Re-queue the AI step that preceded this approval gate so the worker
      // picks it up again with the revision notes included in the input.
      if (meta?.execution_id && meta.step_index !== undefined && meta.step_index > 0) {
        const prevStepIndex = meta.step_index - 1;
        const { data: execution } = await supabase
          .from('workflow_executions')
          .select('workflow_id')
          .eq('id', meta.execution_id)
          .single();

        if (execution) {
          const { data: workflow } = await supabase
            .from('workflows')
            .select('definition')
            .eq('id', execution.workflow_id as string)
            .single();

          const steps = (workflow?.definition as { steps: Record<string, unknown>[] })?.steps || [];
          const prevStep = steps[prevStepIndex] as {
            name: string;
            type: string;
            agent?: string;
            retry_count?: number;
            config?: { model?: string; provider?: string };
          } | undefined;

          if (prevStep?.type === 'ai' && prevStep.agent) {
            const { data: task } = await supabase
              .from('tasks')
              .select('input_data')
              .eq('id', taskId)
              .single();

            const inputData: Record<string, unknown> = {
              ...(task?.input_data as Record<string, unknown> || {}),
              ...(notes ? { revision_notes: notes } : {}),
            };

            const { data: newJob } = await supabase
              .from('ai_jobs')
              .insert({
                task_id: taskId,
                agent_name: prevStep.agent,
                model: prevStep.config?.model || process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
                provider: prevStep.config?.provider || process.env.DEFAULT_LLM_PROVIDER || 'openai',
                status: 'queued',
                prompt: JSON.stringify({ workflow_step: prevStep.name, task_id: taskId, revision: true }),
                input_data: inputData,
                max_retries: prevStep.retry_count ?? 3,
              })
              .select('id')
              .single();

            if (newJob) {
              // Reset the previous step execution to pending and link to the new job
              await supabase
                .from('workflow_step_executions')
                .update({
                  status: 'pending',
                  output_data: null,
                  error_message: null,
                  completed_at: null,
                  started_at: new Date().toISOString(),
                  ai_job_id: newJob.id,
                  input_data: inputData,
                })
                .eq('execution_id', meta.execution_id)
                .eq('step_index', prevStepIndex);

              // Rewind workflow current_step to the step being re-done
              await supabase
                .from('workflow_executions')
                .update({ current_step: prevStepIndex, status: 'running' })
                .eq('id', meta.execution_id);
            }
          }
        }
      }

      return NextResponse.json({
        taskId,
        status: 'revision_requested',
        message: 'Revision requested — previous step re-queued for rework',
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

    // All following writes advance the workflow. If any fails we revert the
    // approval so the client can retry — this is a best-effort compensation
    // strategy (true atomicity would require a DB-level transaction/RPC).
    try {
      // Mark the approval step_execution as completed
      await supabase
        .from('workflow_step_executions')
        .update({
          status: 'completed',
          output_data: { approved: true, approved_at: new Date().toISOString() },
          completed_at: new Date().toISOString(),
        })
        .eq('execution_id', executionId)
        .eq('step_index', approvalStepIndex)
        .throwOnError();

      // Load workflow execution
      const { data: execution } = await supabase
        .from('workflow_executions')
        .select('id, workflow_id, total_steps, current_step')
        .eq('id', executionId)
        .single();

      if (!execution) {
        await revertApproval();
        return NextResponse.json({ error: 'Workflow execution not found' }, { status: 404 });
      }

      const nextStepIndex = approvalStepIndex + 1;

      // Advance current_step
      await supabase
        .from('workflow_executions')
        .update({ current_step: nextStepIndex })
        .eq('id', executionId)
        .throwOnError();

      // All steps done
      if (nextStepIndex >= (execution.total_steps as number)) {
        await supabase
          .from('workflow_executions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', executionId)
          .throwOnError();
        await supabase
          .from('tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', taskId)
          .throwOnError();

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
        })
        .throwOnError();
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', current_step: nextStepIndex + 1, completed_at: new Date().toISOString() })
        .eq('id', executionId)
        .throwOnError();
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId)
        .throwOnError();

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
        (acc, s) => {
          if (s.output_data) acc[s.step_name as string] = s.output_data;
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
          await revertApproval();
          return NextResponse.json({ error: 'Failed to queue next job' }, { status: 500 });
        }

        if (stepExec) {
          await supabase
            .from('workflow_step_executions')
            .update({ ai_job_id: newJob.id })
            .eq('id', stepExec.id as string);
        }

        await supabase.from('tasks').update({ status: 'running' }).eq('id', taskId).throwOnError();

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
        }).throwOnError();
        await supabase
          .from('workflow_step_executions')
          .insert({
            execution_id: executionId,
            step_index: nextStepIndex,
            step_name: nextStep.name,
            status: 'pending',
            started_at: new Date().toISOString(),
          }).throwOnError();
        await supabase.from('tasks').update({ status: 'waiting_approval' }).eq('id', taskId).throwOnError();

        return NextResponse.json({
          taskId,
          status: 'waiting_approval',
          message: `Approved. Next step requires another approval: ${nextStep.name}`,
        });
      }

      return NextResponse.json({ taskId, status: 'approved', message: 'Approved' });

    } catch (workflowErr) {
      // Compensate: revert the approval so the client can retry
      await revertApproval();
      console.error('[approvals] Workflow advancement failed, approval reverted:', workflowErr);
      return NextResponse.json({ error: 'Failed to advance workflow. Please try again.' }, { status: 500 });
    }
  } catch (err) {
    console.error('[approvals] Unhandled error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
