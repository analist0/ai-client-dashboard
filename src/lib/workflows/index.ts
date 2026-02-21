/**
 * Workflows Module
 */

export {
  WorkflowExecutor,
  WorkflowManager,
  workflowManager,
  type WorkflowExecutorOptions,
  type StepExecutionResult,
} from './workflow-engine';

export {
  blogPostWorkflow,
  seoAuditWorkflow,
  landingPageWorkflow,
  socialMediaCampaignWorkflow,
  productDescriptionWorkflow,
  emailCampaignWorkflow,
  defaultWorkflows,
  getWorkflowForTaskType,
  getAvailableWorkflowNames,
} from './default-workflows';
