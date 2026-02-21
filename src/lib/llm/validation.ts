/**
 * Zod Schemas for AI Agent Output Validation
 * Ensures agent outputs match expected structures
 */

import { z } from 'zod';

// =====================================================
// COMMON SCHEMAS
// =====================================================

/**
 * Token usage schema
 */
export const tokenUsageSchema = z.object({
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
});

/**
 * Generic agent output schema
 */
export const agentOutputSchema = z.object({
  success: z.boolean(),
  data: z.record(z.unknown()),
  summary: z.string().optional(),
  error: z.string().optional(),
  metadata: z.object({
    tokenUsage: tokenUsageSchema.optional(),
    executionTimeMs: z.number().optional(),
    model: z.string().optional(),
  }).optional(),
});

// =====================================================
// RESEARCH AGENT OUTPUT
// =====================================================

export const researchOutputSchema = z.object({
  summary: z.string().min(10),
  keyFindings: z.array(z.string()).min(1),
  dataPoints: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url().optional(),
    relevance: z.string(),
  })).optional(),
  relatedTopics: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;

// =====================================================
// WRITER AGENT OUTPUT
// =====================================================

export const writerOutputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(50),
  excerpt: z.string().optional(),
  headings: z.array(z.string()).optional(),
  wordCount: z.number().int().min(0).optional(),
  readingTime: z.number().int().min(0).optional(),
  seoTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export type WriterOutput = z.infer<typeof writerOutputSchema>;

// =====================================================
// EDITOR AGENT OUTPUT
// =====================================================

export const editorOutputSchema = z.object({
  editedContent: z.string().min(50),
  editedTitle: z.string().optional(),
  changesSummary: z.string(),
  issuesFound: z.array(z.object({
    type: z.enum(['grammar', 'style', 'clarity', 'factual']),
    original: z.string(),
    suggestion: z.string(),
    explanation: z.string(),
  })).optional(),
  improvementSuggestions: z.array(z.string()).optional(),
  qualityScore: z.number().min(1).max(10).optional(),
  readabilityScore: z.number().min(0).max(100).optional(),
  toneAnalysis: z.string().optional(),
});

export type EditorOutput = z.infer<typeof editorOutputSchema>;

// =====================================================
// SEO AGENT OUTPUT
// =====================================================

export const seoOutputSchema = z.object({
  seoScore: z.number().min(0).max(100),
  keywordAnalysis: z.object({
    primaryKeyword: z.string(),
    secondaryKeywords: z.array(z.string()).optional(),
    keywordDensity: z.number().min(0).optional(),
    recommendations: z.array(z.string()).optional(),
  }),
  metaTags: z.object({
    title: z.string(),
    description: z.string(),
    ogTitle: z.string().optional(),
    ogDescription: z.string().optional(),
    twitterCard: z.string().optional(),
  }),
  contentOptimization: z.object({
    wordCount: z.number().int().min(0),
    readabilityScore: z.number().min(0).max(100).optional(),
    headingStructure: z.array(z.string()).optional(),
    improvements: z.array(z.object({
      section: z.string(),
      suggestion: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    })).optional(),
  }),
  technicalSeo: z.object({
    urlSlug: z.string(),
    canonicalUrl: z.string().url().optional(),
    schemaMarkup: z.record(z.unknown()).optional(),
    checklist: z.array(z.object({
      item: z.string(),
      status: z.enum(['pass', 'fail', 'warning']),
    })).optional(),
  }),
  linkRecommendations: z.object({
    internalLinks: z.array(z.object({
      anchor: z.string(),
      target: z.string(),
    })).optional(),
    externalLinks: z.array(z.object({
      anchor: z.string(),
      url: z.string().url(),
      reason: z.string(),
    })).optional(),
  }),
});

export type SeoOutput = z.infer<typeof seoOutputSchema>;

// =====================================================
// PLANNER AGENT OUTPUT
// =====================================================

export const plannerOutputSchema = z.object({
  projectPlan: z.object({
    summary: z.string(),
    objectives: z.array(z.string()),
    phases: z.array(z.object({
      name: z.string(),
      tasks: z.array(z.unknown()),
      duration: z.string(),
    })).optional(),
  }),
  tasks: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.string(),
    estimatedHours: z.number().min(0),
    priority: z.number().min(1).max(10),
    dependencies: z.array(z.string()).optional(),
    assignedAgent: z.string().optional(),
    inputRequirements: z.record(z.unknown()).optional(),
    expectedOutput: z.string(),
  })),
  timeline: z.object({
    startDate: z.string(),
    endDate: z.string(),
    milestones: z.array(z.object({
      name: z.string(),
      date: z.string(),
      tasks: z.array(z.string()).optional(),
    })).optional(),
  }),
  resources: z.object({
    requiredAgents: z.array(z.string()),
    estimatedCost: z.number().optional(),
    notes: z.string().optional(),
  }),
  risks: z.array(z.object({
    description: z.string(),
    probability: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })).optional(),
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Validate and parse agent output with fallback
 * Returns validated data or partial data with error info
 */
export function validateAgentOutput<T extends z.ZodType>(
  schema: T,
  data: unknown,
  fallback: z.infer<T>
): { valid: true; data: z.infer<T> } | { valid: false; data: z.infer<T>; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  // Return fallback with error info
  return {
    valid: false,
    data: fallback,
    errors: result.error.issues,
  };
}

/**
 * Get validation error summary
 */
export function getValidationSummary(errors: z.ZodIssue[]): string {
  return errors
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
}

// =====================================================
// AGENT TYPE TO SCHEMA MAPPING
// =====================================================

export const agentSchemaMap: Record<string, z.ZodType> = {
  ResearchAgent: researchOutputSchema,
  WriterAgent: writerOutputSchema,
  EditorAgent: editorOutputSchema,
  SeoAgent: seoOutputSchema,
  PlannerAgent: plannerOutputSchema,
};

/**
 * Get schema for agent type
 */
export function getSchemaForAgent(agentName: string): z.ZodType | null {
  return agentSchemaMap[agentName] || null;
}
