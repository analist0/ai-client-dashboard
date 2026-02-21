/**
 * End-to-End Example: Blog Post Creation Workflow
 * 
 * This example demonstrates the complete flow:
 * 1. Admin creates a project
 * 2. Admin creates a task with workflow
 * 3. Worker picks up the task
 * 4. AI agents execute in sequence (Research → Write → Edit → SEO)
 * 5. Task goes to client approval
 * 6. Client approves/rejects
 * 7. Task completes
 * 
 * Run this script to see the full flow in action:
 *   npx tsx examples/blog-post-workflow.ts
 */

import { createClient } from '@supabase/supabase-js';
import { workflowManager } from '../src/lib/workflows/workflow-engine.js';
import { blogPostWorkflow } from '../src/lib/workflows/default-workflows.js';

// =====================================================
// CONFIGURATION
// =====================================================

const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function log(step: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${step}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =====================================================
// STEP 1: CREATE CLIENT (if not exists)
// =====================================================

async function createOrGetClient(email: string) {
  log('📋 Step 1: Creating or getting client...', { email });

  // Find or create user
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    log('✓ Found existing user', { userId });
  } else {
    // In production, user would sign up via auth
    // For demo, we'll use a placeholder
    userId = crypto.randomUUID();
    await supabase.from('users').insert({
      id: userId,
      email,
      role: 'client',
      full_name: 'Demo Client',
    });
    log('✓ Created new user', { userId });
  }

  // Find or create client
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingClient) {
    log('✓ Found existing client', { clientId: existingClient.id });
    return existingClient.id;
  }

  const { data: newClient } = await supabase
    .from('clients')
    .insert({
      user_id: userId,
      company_name: 'Demo Company',
      industry: 'Technology',
    })
    .select()
    .single();

  log('✓ Created new client', { clientId: newClient?.id });
  return newClient!.id;
}

// =====================================================
// STEP 2: CREATE PROJECT
// =====================================================

async function createProject(clientId: string) {
  log('📁 Step 2: Creating project...');

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      client_id: clientId,
      name: 'AI Blog Post Series',
      description: 'A series of blog posts about AI trends and developments',
      status: 'active',
      start_date: new Date().toISOString(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      budget: 5000,
      currency: 'USD',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  log('✓ Project created', { 
    projectId: project.id, 
    name: project.name,
    deadline: project.deadline,
  });

  return project.id;
}

// =====================================================
// STEP 3: CREATE TASK WITH WORKFLOW
// =====================================================

async function createTask(projectId: string) {
  log('📝 Step 3: Creating task with blog post workflow...');

  // First, ensure the workflow exists in DB
  const { data: existingWorkflow } = await supabase
    .from('workflows')
    .select('id')
    .eq('name', 'Blog Post Workflow')
    .single();

  let workflowId: string;

  if (existingWorkflow) {
    workflowId = existingWorkflow.id;
    log('✓ Using existing workflow', { workflowId });
  } else {
    // Insert the workflow
    const { data: newWorkflow } = await supabase
      .from('workflows')
      .insert({
        name: 'Blog Post Workflow',
        description: 'Complete blog post creation from research to publishing',
        task_type: 'blog_post',
        definition: blogPostWorkflow,
        is_active: true,
      })
      .select()
      .single();

    workflowId = newWorkflow!.id;
    log('✓ Created new workflow', { workflowId });
  }

  // Create the task
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      project_id: projectId,
      workflow_id: workflowId,
      name: 'Write Blog Post: AI Trends in 2024',
      description: 'Create a comprehensive blog post about AI trends expected in 2024',
      type: 'blog_post',
      status: 'pending',
      priority: 8,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      assigned_agent: 'WriterAgent',
      input_data: {
        topic: 'AI Trends in 2024',
        targetAudience: 'Tech professionals and business leaders',
        keywords: ['AI', 'machine learning', '2024 trends', 'automation', 'generative AI'],
        wordCount: 2000,
        style: 'professional',
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  log('✓ Task created', {
    taskId: task.id,
    name: task.name,
    workflowId: task.workflow_id,
  });

  return { taskId: task.id, workflowId };
}

// =====================================================
// STEP 4: START WORKFLOW EXECUTION
// =====================================================

async function startWorkflow(taskId: string, workflowId: string) {
  log('⚡ Step 4: Starting workflow execution...');

  try {
    const execution = await workflowManager.executeWorkflow(taskId, workflowId, {
      onStepComplete: (step, context) => {
        log('✓ Step completed', {
          stepName: step.step_name,
          stepIndex: step.step_index,
          status: step.status,
        });
      },
      onStepFail: (step, error) => {
        log('❌ Step failed', {
          stepName: step.step_name,
          error,
        });
      },
      onWorkflowComplete: (execution) => {
        log('🎉 Workflow completed!', {
          executionId: execution.id,
          status: execution.status,
        });
      },
      onWorkflowFail: (execution, error) => {
        log('💥 Workflow failed', {
          executionId: execution.id,
          error,
        });
      },
    });

    log('✓ Workflow execution started', {
      executionId: execution.id,
      totalSteps: execution.total_steps,
    });

    return execution.id;
  } catch (error) {
    log('❌ Failed to start workflow', { error: String(error) });
    throw error;
  }
}

// =====================================================
// STEP 5: MONITOR PROGRESS
// =====================================================

async function monitorProgress(executionId: string, taskId: string) {
  log('📊 Step 5: Monitoring progress...');

  let completed = false;
  let maxIterations = 50; // Prevent infinite loop

  while (!completed && maxIterations > 0) {
    await sleep(2000); // Check every 2 seconds

    // Get workflow execution status
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (!execution) {
      log('⚠️ Execution not found');
      break;
    }

    log('📈 Progress update', {
      currentStep: execution.current_step,
      totalSteps: execution.total_steps,
      status: execution.status,
    });

    // Get current step details
    const { data: currentStep } = await supabase
      .from('workflow_step_executions')
      .select('*')
      .eq('execution_id', executionId)
      .eq('step_index', execution.current_step)
      .single();

    if (currentStep) {
      log('  Current step:', {
        name: currentStep.step_name,
        status: currentStep.status,
        agent: currentStep.agent_name,
      });
    }

    // Check if complete
    if (execution.status === 'completed' || execution.status === 'failed') {
      completed = true;
      log('🏁 Workflow finished', { status: execution.status });
    }

    // Check if waiting for approval
    if (currentStep?.status === 'pending') {
      log('⏸️  Workflow paused for approval');
      
      // Simulate client approval (in production, client would do this via UI)
      const shouldApprove = true;
      
      if (shouldApprove) {
        log('✓ Simulating client approval...');
        
        // Update approval
        await supabase
          .from('approvals')
          .update({
            status: 'approved',
            responded_at: new Date().toISOString(),
          })
          .eq('task_id', taskId)
          .eq('status', 'pending');

        // Update task
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);

        // Update workflow execution to continue
        await supabase
          .from('workflow_executions')
          .update({
            current_step: execution.current_step + 1,
            status: 'running',
          })
          .eq('id', executionId);

        log('✓ Approval granted, workflow continuing...');
      }
    }

    maxIterations--;
  }

  if (maxIterations <= 0) {
    log('⚠️ Monitoring timeout - workflow may still be running');
  }
}

// =====================================================
// STEP 6: VIEW RESULTS
// =====================================================

async function viewResults(taskId: string) {
  log('📋 Step 6: Viewing results...');

  // Get task with output
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  log('Task final status', {
    id: task?.id,
    name: task?.name,
    status: task?.status,
    completedAt: task?.completed_at,
  });

  // Get AI jobs
  const { data: aiJobs } = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at');

  log(`AI Jobs executed: ${aiJobs?.length || 0}`);
  
  if (aiJobs && aiJobs.length > 0) {
    aiJobs.forEach((job, i) => {
      log(`  Job ${i + 1}:`, {
        agent: job.agent_name,
        model: job.model,
        status: job.status,
        tokens: job.token_usage?.total_tokens || 0,
        duration: job.execution_time_ms ? `${job.execution_time_ms}ms` : 'N/A',
      });
    });
  }

  // Get workflow execution
  const { data: execution } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('task_id', taskId)
    .single();

  log('Workflow execution summary', {
    id: execution?.id,
    status: execution?.status,
    totalSteps: execution?.total_steps,
    completedAt: execution?.completed_at,
  });

  // Show output data
  if (task?.output_data) {
    log('📄 Task output (preview):', {
      preview: JSON.stringify(task.output_data).substring(0, 500) + '...',
    });
  }
}

// =====================================================
// MAIN EXECUTION
// =====================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   AI Client Dashboard - End-to-End Workflow Example      ║');
  console.log('║   Blog Post Creation: Research → Write → Edit → SEO      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Execute all steps
    const clientId = await createOrGetClient('demo@example.com');
    const projectId = await createProject(clientId);
    const { taskId, workflowId } = await createTask(projectId);
    const executionId = await startWorkflow(taskId, workflowId);
    
    console.log('\n─────────────────────────────────────────────────────────\n');
    console.log('Workflow started! Monitoring progress...\n');
    console.log('Note: In production, the background worker would execute');
    console.log('the AI jobs. This demo shows the workflow structure.\n');
    console.log('─────────────────────────────────────────────────────────\n');
    
    await monitorProgress(executionId, taskId);
    await viewResults(taskId);

    console.log('\n✅ End-to-end example completed!\n');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('blog-post-workflow.ts')) {
  main();
}

export { main };
