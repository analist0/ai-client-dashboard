/**
 * Default Workflow Definitions
 * Pre-built workflows for common task types
 */

import type { WorkflowDefinition } from '@/types';

// =====================================================
// BLOG POST WORKFLOW
// =====================================================

export const blogPostWorkflow: WorkflowDefinition = {
  name: 'Blog Post Workflow',
  description: 'Complete blog post creation from research to publishing',
  steps: [
    {
      name: 'research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          depth: 'comprehensive',
        },
      },
    },
    {
      name: 'outline',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 120,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'blog_post',
          wordCount: 200,
        },
      },
    },
    {
      name: 'writing',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 600,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'blog_post',
          style: 'professional',
        },
      },
    },
    {
      name: 'editing',
      agent: 'EditorAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          editType: 'copyedit',
        },
      },
    },
    {
      name: 'seo_optimization',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          analysisType: 'full',
        },
      },
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 604800, // 7 days
    },
    {
      name: 'publish',
      type: 'publish',
    },
  ],
};

// =====================================================
// SEO AUDIT WORKFLOW
// =====================================================

export const seoAuditWorkflow: WorkflowDefinition = {
  name: 'SEO Audit Workflow',
  description: 'Comprehensive SEO analysis and recommendations',
  steps: [
    {
      name: 'technical_seo',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          analysisType: 'technical',
        },
      },
    },
    {
      name: 'content_seo',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          analysisType: 'content',
        },
      },
    },
    {
      name: 'keyword_research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          depth: 'comprehensive',
        },
      },
    },
    {
      name: 'report_generation',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'documentation',
          style: 'professional',
        },
      },
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 604800,
    },
  ],
};

// =====================================================
// LANDING PAGE WORKFLOW
// =====================================================

export const landingPageWorkflow: WorkflowDefinition = {
  name: 'Landing Page Workflow',
  description: 'Create high-converting landing page content',
  steps: [
    {
      name: 'market_research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          depth: 'comprehensive',
        },
      },
    },
    {
      name: 'copywriting',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'landing_page',
          style: 'persuasive',
        },
      },
    },
    {
      name: 'seo_optimization',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 180,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
      },
    },
    {
      name: 'editing',
      agent: 'EditorAgent',
      type: 'ai',
      timeout_seconds: 180,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          editType: 'copyedit',
        },
      },
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 604800,
    },
  ],
};

// =====================================================
// SOCIAL MEDIA CAMPAIGN WORKFLOW
// =====================================================

export const socialMediaCampaignWorkflow: WorkflowDefinition = {
  name: 'Social Media Campaign Workflow',
  description: 'Create social media content for multiple platforms',
  steps: [
    {
      name: 'trend_research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          depth: 'standard',
        },
      },
    },
    {
      name: 'content_creation',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'social_post',
          style: 'casual',
        },
      },
    },
    {
      name: 'hashtag_research',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 120,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
      },
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 259200, // 3 days
    },
  ],
};

// =====================================================
// PRODUCT DESCRIPTION WORKFLOW
// =====================================================

export const productDescriptionWorkflow: WorkflowDefinition = {
  name: 'Product Description Workflow',
  description: 'Create compelling product descriptions',
  steps: [
    {
      name: 'product_analysis',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 180,
      retry_count: 2,
    },
    {
      name: 'description_writing',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 180,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'product_description',
          style: 'persuasive',
        },
      },
    },
    {
      name: 'seo_optimization',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 120,
      retry_count: 2,
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 259200,
    },
  ],
};

// =====================================================
// EMAIL CAMPAIGN WORKFLOW
// =====================================================

export const emailCampaignWorkflow: WorkflowDefinition = {
  name: 'Email Campaign Workflow',
  description: 'Create email sequences for marketing campaigns',
  steps: [
    {
      name: 'audience_research',
      agent: 'ResearchAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
    },
    {
      name: 'email_writing',
      agent: 'WriterAgent',
      type: 'ai',
      timeout_seconds: 300,
      retry_count: 2,
      config: {
        provider: 'openai',
        model: 'gpt-4o',
        input: {
          contentType: 'email',
          style: 'conversational',
        },
      },
    },
    {
      name: 'subject_line_optimization',
      agent: 'SeoAgent',
      type: 'ai',
      timeout_seconds: 120,
      retry_count: 2,
    },
    {
      name: 'editing',
      agent: 'EditorAgent',
      type: 'ai',
      timeout_seconds: 120,
      retry_count: 2,
    },
    {
      name: 'client_approval',
      type: 'wait_for_approval',
      timeout_seconds: 259200,
    },
  ],
};

// =====================================================
// EXPORT ALL WORKFLOWS
// =====================================================

export const defaultWorkflows: Record<string, WorkflowDefinition> = {
  blog_post: blogPostWorkflow,
  seo_audit: seoAuditWorkflow,
  landing_page: landingPageWorkflow,
  social_media_campaign: socialMediaCampaignWorkflow,
  product_description: productDescriptionWorkflow,
  email_campaign: emailCampaignWorkflow,
};

/**
 * Get workflow definition by task type
 */
export function getWorkflowForTaskType(taskType: string): WorkflowDefinition | null {
  return defaultWorkflows[taskType] || null;
}

/**
 * Get all available workflow names
 */
export function getAvailableWorkflowNames(): string[] {
  return Object.keys(defaultWorkflows);
}
