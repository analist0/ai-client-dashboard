/**
 * Workflow Engine
 * Executes workflow definitions with AI agents
 */

import type {
  Workflow,
  WorkflowDefinition,
  WorkflowStepDefinition,
  WorkflowExecution,
  WorkflowStepExecution,
  Task,
  AgentInput,
  AgentOutput,
  JobStatus,
  TaskStatus,
} from '@/types';
import { getAgent } from '@/lib/agents';
import { createServerClient } from '@/lib/supabase/client';

// =====================================================
// WORKFLOW EXECUTOR
// =====================================================

export interface WorkflowExecutorOptions {
  taskId: string;
  workflow: Workflow;
  initialContext?: Record<string, unknown>;
  onStepComplete?: (step: WorkflowStepExecution, context: Record<string, unknown>) => void;
  onStepFail?: (step: WorkflowStepExecution, error: string) => void;
  onWorkflowComplete?: (execution: WorkflowExecution) => void;
  onWorkflowFail?: (execution: WorkflowExecution, error: string) => void;
}

export interface StepExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  shouldPause?: boolean; // For approval steps
}

export class WorkflowExecutor {
  private execution: WorkflowExecution | null = null;
  private context: Record<string, unknown> = {};
  private options: WorkflowExecutorOptions;

  constructor(options: WorkflowExecutorOptions) {
    this.options = options;
    this.context = options.initialContext || {};
  }

  /**
   * Start workflow execution
   */
  async execute(): Promise<WorkflowExecution> {
    const supabase = createServerClient(undefined, true);

    try {
      // Create workflow execution record
      const { data: execution, error } = await supabase
        .from('workflow_executions')
        .insert({
          task_id: this.options.taskId,
          workflow_id: this.options.workflow.id,
          status: 'running',
          current_step: 0,
          total_steps: this.options.workflow.definition.steps.length,
          context: this.context,
        })
        .select()
        .single();

      if (error || !execution) {
        throw new Error(`Failed to create workflow execution: ${error?.message}`);
      }

      this.execution = execution as unknown as WorkflowExecution;

      // Update task status
      await this.updateTaskStatus('running');

      // Execute each step
      const steps = this.options.workflow.definition.steps;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Check if step should be executed (condition)
        if (step.condition && !this.evaluateCondition(step.condition)) {
          await this.markStepSkipped(i, step);
          continue;
        }

        // Execute step
        const result = await this.executeStep(i, step);

        if (result.shouldPause) {
          // Pause for approval
          return this.execution;
        }

        if (!result.success) {
          // Handle step failure
          const shouldRetry = await this.handleStepFailure(i, step, result.error || 'Unknown error');
          if (!shouldRetry) {
            await this.failWorkflow(result.error || 'Step failed');
            throw new Error(result.error);
          }
          // Retry the step
          i--; // Will re-execute this step
          continue;
        }

        // Update context with step output
        if (result.output) {
          this.context[`step_${step.name}`] = result.output;
          this.context[`step_${step.name}_output`] = result.output;
        }

        // Mark step as completed
        await this.markStepCompleted(i, step, result.output);

        // Notify callback
        if (this.options.onStepComplete) {
          const stepExecution = await this.getStepExecution(i);
          if (stepExecution) {
            this.options.onStepComplete(stepExecution, this.context);
          }
        }
      }

      // Workflow completed successfully
      await this.completeWorkflow();

      return this.execution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.failWorkflow(errorMessage);
      throw error;
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    stepIndex: number,
    step: WorkflowStepDefinition
  ): Promise<StepExecutionResult> {
    const supabase = createServerClient(undefined, true);

    // Create step execution record
    const { data: stepExecution, error: insertError } = await supabase
      .from('workflow_step_executions')
      .insert({
        execution_id: this.execution!.id,
        step_index: stepIndex,
        step_name: step.name,
        agent_name: step.agent || null,
        status: 'running',
        input_data: this.buildStepInput(step),
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !stepExecution) {
      return { success: false, error: `Failed to create step execution: ${insertError?.message}` };
    }

    try {
      // Handle different step types
      if (step.type === 'wait_for_approval') {
        return await this.executeApprovalStep(stepIndex, step, stepExecution.id);
      }

      if (step.type === 'publish' || step.type === 'custom') {
        return await this.executeCustomStep(stepIndex, step, stepExecution.id);
      }

      // Default: AI agent execution
      if (!step.agent) {
        return { success: false, error: `Step ${step.name} has no agent assigned` };
      }

      return await this.executeAgentStep(stepIndex, step, stepExecution.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update step execution with error
      await supabase
        .from('workflow_step_executions')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', stepExecution.id);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute an AI agent step
   */
  private async executeAgentStep(
    stepIndex: number,
    step: WorkflowStepDefinition,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const supabase = createServerClient(undefined, true);

    if (!step.agent) {
      return { success: false, error: 'No agent specified for step' };
    }

    // Get the agent
    const agent = getAgent(step.agent, {
      provider: (step.config?.provider as any) || 'openai',
      model: (step.config?.model as string) || 'gpt-4o',
    });

    // Build agent input
    const agentInput: AgentInput = {
      taskId: this.options.taskId,
      inputData: this.buildStepInput(step),
      context: this.context,
      previousOutputs: await this.getPreviousOutputs(),
    };

    // Execute agent
    const agentOutput = await agent.execute(agentInput);

    // Create AI job record
    const { data: aiJob } = await supabase
      .from('ai_jobs')
      .insert({
        task_id: this.options.taskId,
        agent_name: step.agent,
        model: agent.config.model,
        provider: agent.config.provider,
        status: agentOutput.success ? 'completed' : 'failed',
        prompt: JSON.stringify(agentInput),
        system_prompt: agent.config.systemPrompt,
        input_data: agentInput.inputData,
        output_data: agentOutput.data,
        token_usage: agentOutput.metadata?.tokenUsage || null,
        execution_time_ms: agentOutput.metadata?.executionTimeMs || null,
        error_message: agentOutput.error || null,
        logs: agent.getLogs(),
      })
      .select()
      .single();

    // Update step execution with AI job reference
    await supabase
      .from('workflow_step_executions')
      .update({
        output_data: agentOutput.data,
        ai_job_id: aiJob?.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', stepExecutionId);

    if (!agentOutput.success) {
      return { success: false, error: agentOutput.error };
    }

    return { success: true, output: agentOutput.data };
  }

  /**
   * Execute an approval step
   */
  private async executeApprovalStep(
    stepIndex: number,
    step: WorkflowStepDefinition,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const supabase = createServerClient(undefined, true);

    // Update task status to waiting_approval
    await this.updateTaskStatus('waiting_approval');

    // Create approval record
    const { data: approval } = await supabase
      .from('approvals')
      .insert({
        task_id: this.options.taskId,
        status: 'pending',
        requested_by: null, // Will be set by admin who triggered workflow
        metadata: {
          step_name: step.name,
          step_index: stepIndex,
          context: this.context,
        },
      })
      .select()
      .single();

    // Update step execution
    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'pending', // Stay pending until approval
        output_data: { approval_id: approval?.id },
        completed_at: new Date().toISOString(),
      })
      .eq('id', stepExecutionId);

    // Update workflow execution to current step
    await supabase
      .from('workflow_executions')
      .update({
        current_step: stepIndex,
        context: this.context,
      })
      .eq('id', this.execution!.id);

    // Pause execution
    return { success: true, shouldPause: true };
  }

  /**
   * Execute a custom/publish step
   */
  private async executeCustomStep(
    stepIndex: number,
    step: WorkflowStepDefinition,
    stepExecutionId: string
  ): Promise<StepExecutionResult> {
    const supabase = createServerClient(undefined, true);

    // Custom step logic can be extended here
    // For now, just mark as completed
    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'completed',
        output_data: { step_type: step.type },
        completed_at: new Date().toISOString(),
      })
      .eq('id', stepExecutionId);

    if (step.type === 'publish') {
      await this.updateTaskStatus('completed');
    }

    return { success: true, output: {} };
  }

  /**
   * Build input data for a step
   */
  private buildStepInput(step: WorkflowStepDefinition): Record<string, unknown> {
    const taskData = this.context.task_data || {};
    const previousOutputs = this.context;

    return {
      ...taskData,
      ...previousOutputs,
      ...(step.config?.input || {}),
    };
  }

  /**
   * Get outputs from previous steps
   */
  private async getPreviousOutputs(): Promise<AgentOutput[]> {
    const supabase = createServerClient(undefined, true);

    const { data: steps } = await supabase
      .from('workflow_step_executions')
      .select('output_data, ai_job_id')
      .eq('execution_id', this.execution!.id)
      .eq('status', 'completed')
      .order('step_index', { ascending: true });

    if (!steps || steps.length === 0) {
      return [];
    }

    return steps
      .filter((s) => s.output_data)
      .map((s) => ({
        success: true,
        data: s.output_data as Record<string, unknown>,
        summary: JSON.stringify(s.output_data).substring(0, 500),
      }));
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string): boolean {
    // Simple condition evaluation
    // In production, use a proper expression evaluator
    try {
      // Replace context variables
      let expr = condition;
      for (const [key, value] of Object.entries(this.context)) {
        expr = expr.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), JSON.stringify(value));
      }
      
      // Safe evaluation (in production, use a proper parser)
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${expr}`)();
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Handle step failure
   */
  private async handleStepFailure(
    stepIndex: number,
    step: WorkflowStepDefinition,
    error: string
  ): Promise<boolean> {
    const maxRetries = step.retry_count || 3;
    const supabase = createServerClient(undefined, true);

    // Get current retry count
    const { data: stepExecution } = await supabase
      .from('workflow_step_executions')
      .select('output_data')
      .eq('execution_id', this.execution!.id)
      .eq('step_index', stepIndex)
      .single();

    const retryCount = ((stepExecution?.output_data as any)?.retryCount || 0) + 1;

    if (retryCount <= maxRetries) {
      // Retry
      await supabase
        .from('workflow_step_executions')
        .update({
          output_data: { ...stepExecution?.output_data, retryCount: retryCount },
          status: 'pending',
          error_message: error,
        })
        .eq('id', stepExecution.id);

      return true; // Should retry
    }

    return false; // Max retries exceeded
  }

  /**
   * Mark step as completed
   */
  private async markStepCompleted(
    stepIndex: number,
    step: WorkflowStepDefinition,
    output?: Record<string, unknown>
  ): Promise<void> {
    const supabase = createServerClient(undefined, true);

    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'completed',
        output_data: output || null,
        completed_at: new Date().toISOString(),
      })
      .eq('execution_id', this.execution!.id)
      .eq('step_index', stepIndex);

    // Update current step in execution
    await supabase
      .from('workflow_executions')
      .update({
        current_step: stepIndex + 1,
        context: this.context,
      })
      .eq('id', this.execution!.id);
  }

  /**
   * Mark step as skipped
   */
  private async markStepSkipped(stepIndex: number, step: WorkflowStepDefinition): Promise<void> {
    const supabase = createServerClient(undefined, true);

    await supabase
      .from('workflow_step_executions')
      .insert({
        execution_id: this.execution!.id,
        step_index: stepIndex,
        step_name: step.name,
        status: 'skipped',
      });

    await supabase
      .from('workflow_executions')
      .update({
        current_step: stepIndex + 1,
      })
      .eq('id', this.execution!.id);
  }

  /**
   * Complete the workflow
   */
  private async completeWorkflow(): Promise<void> {
    const supabase = createServerClient(undefined, true);

    await supabase
      .from('workflow_executions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        context: this.context,
      })
      .eq('id', this.execution!.id);

    await this.updateTaskStatus('completed');

    if (this.options.onWorkflowComplete && this.execution) {
      this.options.onWorkflowComplete(this.execution);
    }
  }

  /**
   * Fail the workflow
   */
  private async failWorkflow(error: string): Promise<void> {
    const supabase = createServerClient(undefined, true);

    await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        context: { ...this.context, error },
      })
      .eq('id', this.execution!.id);

    await this.updateTaskStatus('failed');

    if (this.options.onWorkflowFail && this.execution) {
      this.options.onWorkflowFail(this.execution, error);
    }
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(status: TaskStatus): Promise<void> {
    const supabase = createServerClient(undefined, true);

    await supabase
      .from('tasks')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', this.options.taskId);
  }

  /**
   * Get step execution by index
   */
  private async getStepExecution(stepIndex: number): Promise<WorkflowStepExecution | null> {
    const supabase = createServerClient(undefined, true);

    const { data } = await supabase
      .from('workflow_step_executions')
      .select('*')
      .eq('execution_id', this.execution!.id)
      .eq('step_index', stepIndex)
      .single();

    return data as unknown as WorkflowStepExecution | null;
  }

  /**
   * Resume workflow from approval step.
   * Continues execution from current_step without creating a new execution record.
   */
  async resume(approvalStatus: 'approved' | 'rejected' | 'revision_requested'): Promise<void> {
    if (!this.execution) {
      throw new Error('No active execution to resume');
    }

    const supabase = createServerClient(undefined, true);

    // Reload execution state from DB to get latest current_step
    const { data: freshExecution } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', this.execution.id)
      .single();

    if (!freshExecution) throw new Error('Execution not found');
    this.execution = freshExecution as unknown as WorkflowExecution;

    // Update approval record
    await supabase
      .from('approvals')
      .update({ status: approvalStatus, responded_at: new Date().toISOString() })
      .eq('task_id', this.options.taskId)
      .eq('status', 'pending');

    if (approvalStatus === 'rejected') {
      await this.failWorkflow('Approval rejected');
      return;
    }

    if (approvalStatus === 'revision_requested') {
      await this.updateTaskStatus('running');
      return;
    }

    // Mark the approval step_execution as completed
    await supabase
      .from('workflow_step_executions')
      .update({
        status: 'completed',
        output_data: { approved: true },
        completed_at: new Date().toISOString(),
      })
      .eq('execution_id', this.execution.id)
      .eq('step_index', this.execution.current_step);

    // Advance current_step past the approval gate
    const resumeFrom = this.execution.current_step + 1;
    await supabase
      .from('workflow_executions')
      .update({ current_step: resumeFrom })
      .eq('id', this.execution.id);

    this.execution = { ...this.execution, current_step: resumeFrom };

    await this.updateTaskStatus('running');

    // Continue executing remaining steps
    const steps = this.options.workflow.definition.steps;
    for (let i = resumeFrom; i < steps.length; i++) {
      const step = steps[i];

      if (step.condition && !this.evaluateCondition(step.condition)) {
        await this.markStepSkipped(i, step);
        continue;
      }

      const result = await this.executeStep(i, step);

      if (result.shouldPause) return;

      if (!result.success) {
        await this.failWorkflow(result.error || 'Step failed');
        throw new Error(result.error);
      }

      if (result.output) {
        this.context[`step_${step.name}`] = result.output;
      }

      await this.markStepCompleted(i, step, result.output);
    }

    await this.completeWorkflow();
  }
}

// =====================================================
// WORKFLOW MANAGER
// =====================================================

export class WorkflowManager {
  private supabase;

  constructor() {
    this.supabase = createServerClient(undefined, true);
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const { data } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('is_active', true)
      .single();

    return data as unknown as Workflow | null;
  }

  /**
   * Get workflow by name
   */
  async getWorkflowByName(name: string): Promise<Workflow | null> {
    const { data } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('name', name)
      .eq('is_active', true)
      .single();

    return data as unknown as Workflow | null;
  }

  /**
   * Get all active workflows
   */
  async getActiveWorkflows(): Promise<Workflow[]> {
    const { data } = await this.supabase
      .from('workflows')
      .select('*')
      .eq('is_active', true)
      .order('name');

    return (data as unknown as Workflow[]) || [];
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(
    name: string,
    taskType: string,
    definition: WorkflowDefinition,
    description?: string
  ): Promise<Workflow> {
    const { data, error } = await this.supabase
      .from('workflows')
      .insert({
        name,
        task_type: taskType,
        definition,
        description,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create workflow: ${error?.message}`);
    }

    return data as unknown as Workflow;
  }

  /**
   * Execute a workflow for a task
   */
  async executeWorkflow(
    taskId: string,
    workflowId: string,
    options?: Omit<WorkflowExecutorOptions, 'taskId' | 'workflow'>
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Get task data
    const { data: task } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const executor = new WorkflowExecutor({
      taskId,
      workflow,
      initialContext: {
        task_data: {
          ...task.input_data,
          task_name: task.name,
          task_description: task.description,
        },
        ...options?.initialContext,
      },
      ...options,
    });

    return executor.execute();
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager();
