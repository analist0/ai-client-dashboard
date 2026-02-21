#!/usr/bin/env node
/**
 * Background Job Worker
 *
 * - Polls ai_jobs using claim_next_ai_job() RPC (row-level lock, no double execution)
 * - Runs up to WORKER_MAX_CONCURRENT_JOBS in parallel
 * - Exponential backoff retry with next_run_at scheduling
 * - Advances workflow step-by-step after each job completes
 * - Stuck job reaper every WORKER_REAP_INTERVAL_MS
 * - Graceful shutdown on SIGTERM/SIGINT
 *
 * Start: npm run worker
 */

import { createClient } from '@supabase/supabase-js';
import { getAgent, hasAgent } from '../src/lib/agents/index.js';

// =====================================================
// CONFIG
// =====================================================

const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10),
  maxConcurrentJobs: parseInt(process.env.WORKER_MAX_CONCURRENT_JOBS || '3', 10),
  jobTimeoutMs: parseInt(process.env.WORKER_JOB_TIMEOUT_MS || '300000', 10),
  stuckJobTimeoutMinutes: parseInt(process.env.WORKER_STUCK_JOB_TIMEOUT_MINUTES || '30', 10),
  reapIntervalMs: parseInt(process.env.WORKER_REAP_INTERVAL_MS || '300000', 10),
  defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
  defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
};

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.error('[WORKER] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// =====================================================
// DB CLIENT
// =====================================================

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// =====================================================
// STATE
// =====================================================

let isRunning = true;
const activeJobs = new Map<string, { abortController: AbortController; startTime: number }>();
let processedCount = 0;
let failedCount = 0;
let pollCount = 0;
let lastSuccessfulPoll = Date.now();
const workerStartTime = Date.now();

// =====================================================
// LOGGING
// =====================================================

function log(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, unknown>
) {
  const ts = new Date().toISOString();
  const icon = { info: 'ℹ', warn: '⚠', error: '✗', debug: '·' }[level];
  const uptimeSec = Math.floor((Date.now() - workerStartTime) / 1000);
  const base = { ts, uptime_sec: uptimeSec, ...(data || {}) };
  console.log(`[${ts}] ${icon} ${message} ${JSON.stringify(base)}`);
}

/** Emit a periodic heartbeat — logged every HEARTBEAT_INTERVAL_MS. */
const HEARTBEAT_INTERVAL_MS = 60_000;
let lastHeartbeat = Date.now();

function maybeHeartbeat() {
  if (Date.now() - lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;
  lastHeartbeat = Date.now();
  log('info', 'Worker heartbeat', {
    activeJobs: activeJobs.size,
    processedCount,
    failedCount,
    pollCount,
    uptimeSec: Math.floor((Date.now() - workerStartTime) / 1000),
    idleSinceSec: Math.floor((Date.now() - lastSuccessfulPoll) / 1000),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// CLAIM JOB
// =====================================================

async function claimNextJob(): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase.rpc('claim_next_ai_job');
    if (error) {
      log('error', 'claim_next_ai_job failed', { error: error.message });
      return null;
    }
    const jobs = data as Record<string, unknown>[];
    return jobs?.[0] ?? null;
  } catch (err) {
    log('error', 'Exception in claimNextJob', { error: String(err) });
    return null;
  }
}

// =====================================================
// COMPLETE JOB
// =====================================================

async function completeJob(
  jobId: string,
  output: Record<string, unknown>,
  tokenUsage?: Record<string, number>,
  executionTimeMs?: number
) {
  const { error } = await supabase
    .from('ai_jobs')
    .update({
      status: 'completed',
      output_data: output,
      token_usage: tokenUsage ?? null,
      execution_time_ms: executionTimeMs ?? null,
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq('id', jobId);

  if (error) {
    log('error', 'Failed to mark job completed', { jobId, error: error.message });
    return;
  }

  processedCount++;
  log('info', 'Job completed', { jobId, processedCount });
}

// =====================================================
// FAIL JOB  (single query — no race condition)
// =====================================================

async function failJob(jobId: string, errorMessage: string) {
  try {
    const { data: job } = await supabase
      .from('ai_jobs')
      .select('retry_count, max_retries, task_id')
      .eq('id', jobId)
      .single();

    if (!job) return;

    const currentAttempts = (job.retry_count as number) || 0;
    const maxAttempts = (job.max_retries as number) || 3;

    if (currentAttempts < maxAttempts) {
      // Exponential backoff: 2^attempts seconds + jitter, capped at 10 min
      const backoffSec = Math.min(Math.pow(2, currentAttempts), 600);
      const jitter = Math.floor(Math.random() * 5);
      const nextRunAt = new Date(Date.now() + (backoffSec + jitter) * 1000).toISOString();

      await supabase
        .from('ai_jobs')
        .update({
          status: 'queued',
          last_error: errorMessage,
          error_message: errorMessage,
          retry_count: currentAttempts,
          locked_at: null,
          locked_by: null,
          started_at: null,
          next_run_at: nextRunAt,
        })
        .eq('id', jobId);

      log('warn', 'Job requeued for retry', {
        jobId,
        attempt: currentAttempts,
        nextRunAt,
        backoffSec,
      });
    } else {
      // Permanently failed
      await supabase
        .from('ai_jobs')
        .update({
          status: 'failed',
          last_error: errorMessage,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
        })
        .eq('id', jobId);

      if (job.task_id) {
        await supabase
          .from('tasks')
          .update({ status: 'failed' })
          .eq('id', job.task_id as string);
      }

      failedCount++;
      log('error', 'Job permanently failed', { jobId, failedCount });
    }
  } catch (err) {
    log('error', 'Exception in failJob', { jobId, error: String(err) });
  }
}

// =====================================================
// WORKFLOW CONTINUATION
// =====================================================

/**
 * After a job completes, advance the workflow to the next step.
 * - Marks the current step_execution as completed
 * - Creates the next ai_job + step_execution, OR creates approval record, OR completes workflow
 */
async function checkAndContinueWorkflow(
  jobId: string,
  taskId: string,
  outputData: Record<string, unknown>
) {
  try {
    // Look up the step execution linked to this job
    const { data: stepExec } = await supabase
      .from('workflow_step_executions')
      .select('id, execution_id, step_index, step_name')
      .eq('ai_job_id', jobId)
      .maybeSingle();

    // Standalone job (not part of a workflow) — nothing to advance
    if (!stepExec) return;

    // Mark this step as completed with its output
    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'completed',
        output_data: outputData,
        completed_at: new Date().toISOString(),
      })
      .eq('id', stepExec.id as string);

    // Load the workflow execution
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('id, workflow_id, status, current_step, total_steps')
      .eq('id', stepExec.execution_id as string)
      .single();

    if (!execution || execution.status !== 'running') return;

    const nextStepIndex = (stepExec.step_index as number) + 1;

    // Advance current_step pointer
    await supabase
      .from('workflow_executions')
      .update({ current_step: nextStepIndex })
      .eq('id', execution.id as string);

    // Check if all steps completed
    if (nextStepIndex >= (execution.total_steps as number)) {
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', execution.id as string);
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      log('info', 'Workflow completed', { executionId: execution.id, taskId });
      return;
    }

    // Load workflow definition
    const { data: workflow } = await supabase
      .from('workflows')
      .select('definition')
      .eq('id', execution.workflow_id as string)
      .single();

    const steps = (workflow?.definition as { steps: Record<string, unknown>[] })?.steps;
    if (!steps || nextStepIndex >= steps.length) {
      // Definition shorter than total_steps — complete gracefully
      await supabase
        .from('workflow_executions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', execution.id as string);
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      return;
    }

    const nextStep = steps[nextStepIndex] as {
      name: string;
      type: string;
      agent?: string;
      retry_count?: number;
      config?: { model?: string; provider?: string; input?: Record<string, unknown> };
    };

    // ── Approval step ────────────────────────────────
    if (nextStep.type === 'wait_for_approval') {
      // Idempotent: don't create duplicate approval records
      const { data: existing } = await supabase
        .from('approvals')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'pending')
        .maybeSingle();

      if (!existing) {
        await supabase.from('approvals').insert({
          task_id: taskId,
          status: 'pending',
          metadata: {
            step_name: nextStep.name,
            step_index: nextStepIndex,
            execution_id: execution.id,
          },
        });
      }

      // Record step execution for the approval gate
      await insertStepExecution(execution.id as string, nextStepIndex, nextStep.name, null, null);

      await supabase
        .from('tasks')
        .update({ status: 'waiting_approval' })
        .eq('id', taskId);

      log('info', 'Workflow paused for approval', {
        executionId: execution.id,
        step: nextStep.name,
        taskId,
      });
      return;
    }

    // ── Publish step ─────────────────────────────────
    if (nextStep.type === 'publish') {
      await insertStepExecution(
        execution.id as string,
        nextStepIndex,
        nextStep.name,
        null,
        { published: true, published_at: new Date().toISOString() },
        'completed'
      );
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          current_step: nextStepIndex + 1,
          completed_at: new Date().toISOString(),
        })
        .eq('id', execution.id as string);
      await supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', taskId);
      log('info', 'Workflow published and completed', { executionId: execution.id, taskId });
      return;
    }

    // ── AI step ──────────────────────────────────────
    if (nextStep.type === 'ai' && nextStep.agent) {
      // Collect previous step outputs for context
      const { data: doneSteps } = await supabase
        .from('workflow_step_executions')
        .select('step_name, output_data')
        .eq('execution_id', execution.id as string)
        .eq('status', 'completed')
        .order('step_index', { ascending: true });

      const previousOutputs = (doneSteps || []).reduce(
        (acc, s) => {
          if (s.output_data) acc[s.step_name as string] = s.output_data;
          return acc;
        },
        {} as Record<string, unknown>
      );

      const { data: task } = await supabase
        .from('tasks')
        .select('input_data')
        .eq('id', taskId)
        .single();

      const inputData: Record<string, unknown> = {
        ...(task?.input_data as Record<string, unknown> || {}),
        ...previousOutputs,
        ...(nextStep.config?.input || {}),
      };

      // Create step execution record first (status: pending)
      const newStepExecId = await insertStepExecution(
        execution.id as string,
        nextStepIndex,
        nextStep.name,
        nextStep.agent,
        inputData
      );

      // Queue the next ai_job
      const { data: newJob, error: jobErr } = await supabase
        .from('ai_jobs')
        .insert({
          task_id: taskId,
          agent_name: nextStep.agent,
          model: nextStep.config?.model || config.defaultModel,
          provider: nextStep.config?.provider || config.defaultProvider,
          status: 'queued',
          prompt: JSON.stringify({ workflow_step: nextStep.name, task_id: taskId }),
          input_data: inputData,
          max_retries: nextStep.retry_count ?? 3,
        })
        .select('id')
        .single();

      if (jobErr) {
        log('error', 'Failed to queue next workflow step', { error: jobErr.message });
        return;
      }

      // Link step execution → new job
      if (newStepExecId && newJob) {
        await supabase
          .from('workflow_step_executions')
          .update({ ai_job_id: newJob.id })
          .eq('id', newStepExecId);
      }

      log('info', 'Queued next workflow step', {
        executionId: execution.id,
        step: nextStep.name,
        agent: nextStep.agent,
        newJobId: newJob?.id,
      });
    }
  } catch (err) {
    log('error', 'Exception in checkAndContinueWorkflow', { jobId, taskId, error: String(err) });
  }
}

/**
 * Insert a workflow_step_executions record, ignoring duplicates.
 * Returns the new record id, or existing id if duplicate.
 */
async function insertStepExecution(
  executionId: string,
  stepIndex: number,
  stepName: string,
  agentName: string | null,
  inputData: Record<string, unknown> | null,
  status = 'pending',
  outputData?: Record<string, unknown>
): Promise<string | null> {
  // Check for existing record first
  const { data: existing } = await supabase
    .from('workflow_step_executions')
    .select('id')
    .eq('execution_id', executionId)
    .eq('step_index', stepIndex)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data } = await supabase
    .from('workflow_step_executions')
    .insert({
      execution_id: executionId,
      step_index: stepIndex,
      step_name: stepName,
      agent_name: agentName,
      status,
      input_data: inputData,
      started_at: new Date().toISOString(),
      ...(outputData ? { output_data: outputData, completed_at: new Date().toISOString() } : {}),
    })
    .select('id')
    .single();

  return data?.id as string | null;
}

// =====================================================
// EXECUTE JOB
// =====================================================

async function executeJob(job: Record<string, unknown>) {
  const jobId = job.id as string;
  const taskId = job.task_id as string;

  const abortController = new AbortController();
  activeJobs.set(jobId, { abortController, startTime: Date.now() });

  log('info', 'Starting job', {
    jobId,
    agent: job.agent_name,
    model: job.model,
    provider: job.provider,
    taskId,
  });

  try {
    // Mark linked step execution as running (if any)
    await supabase
      .from('workflow_step_executions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('ai_job_id', jobId);

    if (!hasAgent(job.agent_name as string)) {
      throw new Error(`Unknown agent: ${job.agent_name}`);
    }

    const agent = getAgent(job.agent_name as string, {
      provider: job.provider as string,
      model: job.model as string,
      timeoutMs: config.jobTimeoutMs,
    });

    const inputData =
      typeof job.input_data === 'string'
        ? JSON.parse(job.input_data as string)
        : (job.input_data as Record<string, unknown>) || {};

    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${config.jobTimeoutMs}ms`)),
        config.jobTimeoutMs
      )
    );

    const agentOutput = await Promise.race([
      agent.execute({ taskId, inputData, context: {}, previousOutputs: [] }),
      timeoutPromise,
    ]);

    if (!agentOutput.success) {
      throw new Error(agentOutput.error || 'Agent returned failure');
    }

    const outputData = agentOutput.data || {};

    await completeJob(
      jobId,
      outputData,
      agentOutput.metadata?.tokenUsage as Record<string, number> | undefined,
      agentOutput.metadata?.executionTimeMs as number | undefined
    );

    // Persist output to task
    await supabase
      .from('tasks')
      .update({ output_data: outputData })
      .eq('id', taskId);

    // Advance workflow (if this job belongs to one)
    await checkAndContinueWorkflow(jobId, taskId, outputData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('error', 'Job failed', { jobId, error: msg });

    // Mark linked step execution as failed
    await supabase
      .from('workflow_step_executions')
      .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
      .eq('ai_job_id', jobId);

    await failJob(jobId, msg);
  } finally {
    activeJobs.delete(jobId);
  }
}

// =====================================================
// TIMEOUT CHECKER
// =====================================================

async function checkTimedOutJobs() {
  const now = Date.now();
  for (const [jobId, info] of activeJobs.entries()) {
    if (now - info.startTime > config.jobTimeoutMs) {
      log('warn', 'Job timed out locally', { jobId });
      info.abortController.abort();
      activeJobs.delete(jobId);
      await failJob(jobId, `Timed out after ${config.jobTimeoutMs}ms`);
    }
  }
}

// =====================================================
// STUCK JOB REAPER
// =====================================================

async function reapStuckJobs() {
  try {
    const { data, error } = await supabase.rpc('reap_stuck_jobs', {
      timeout_minutes: config.stuckJobTimeoutMinutes,
    });
    if (error) {
      log('error', 'reap_stuck_jobs failed', { error: error.message });
      return;
    }
    const reaped = (data as Record<string, unknown>[]) || [];
    if (reaped.length > 0) {
      log('warn', `Reaped ${reaped.length} stuck jobs`, {
        ids: reaped.map((j) => j.id),
      });
    }
  } catch (err) {
    log('error', 'Exception in reapStuckJobs', { error: String(err) });
  }
}

// =====================================================
// MAIN LOOP
// =====================================================

async function workerLoop() {
  log('info', 'Worker started', {
    pollIntervalMs: config.pollIntervalMs,
    maxConcurrentJobs: config.maxConcurrentJobs,
    jobTimeoutMs: config.jobTimeoutMs,
  });

  const reapInterval = setInterval(reapStuckJobs, config.reapIntervalMs);

  while (isRunning) {
    try {
      // Fill all available concurrent slots per tick
      while (activeJobs.size < config.maxConcurrentJobs) {
        const job = await claimNextJob();
        if (!job) break; // No queued jobs available

        lastSuccessfulPoll = Date.now();
        executeJob(job).catch((err) =>
          log('error', 'Unhandled error in executeJob', { error: String(err) })
        );
      }

      pollCount++;
      await checkTimedOutJobs();
      maybeHeartbeat();
      await sleep(config.pollIntervalMs);
    } catch (err) {
      log('error', 'Worker loop error', { error: String(err) });
      await sleep(config.pollIntervalMs);
    }
  }

  clearInterval(reapInterval);
  log('info', 'Worker stopped', { processedCount, failedCount });
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    log('info', `Received ${signal}, shutting down`, {
      activeJobs: activeJobs.size,
      processedCount,
      failedCount,
    });

    isRunning = false;

    const deadline = Date.now() + 30_000;
    while (activeJobs.size > 0 && Date.now() < deadline) {
      log('info', `Waiting for ${activeJobs.size} active jobs…`);
      await sleep(1000);
    }

    if (activeJobs.size > 0) {
      log('warn', 'Forcing shutdown with active jobs', {
        count: activeJobs.size,
        ids: Array.from(activeJobs.keys()),
      });
    }

    log('info', 'Shutdown complete', { processedCount, failedCount });
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) =>
    log('error', 'Uncaught exception', { error: String(err), stack: err.stack })
  );
  process.on('unhandledRejection', (reason) =>
    log('error', 'Unhandled rejection', { reason: String(reason) })
  );
}

// =====================================================
// ENTRY POINT
// =====================================================

setupGracefulShutdown();
workerLoop().catch((err) => {
  log('error', 'Worker crashed', { error: String(err), stack: (err as Error).stack });
  process.exit(1);
});
