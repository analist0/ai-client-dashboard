/**
 * LLM Module
 * Unified interface for all LLM providers
 */

export {
  callOllamaGenerate,
  callOllamaChat,
  checkOllamaHealth,
  detectOllamaStatus,
  listOllamaModels,
  listOllamaModelDetails,
  getOllamaModelInfo,
  pullOllamaModel,
  deleteOllamaModel,
  getInstallInstructions,
  type OllamaConfig,
  type OllamaResponse,
  type OllamaChatResponse,
  type OllamaModelDetails,
  type OllamaStatus,
  type OllamaServiceStatus,
  type OllamaInstallInstructions,
  type OllamaPullProgress,
} from './ollama';

export {
  // Schemas
  tokenUsageSchema,
  agentOutputSchema,
  researchOutputSchema,
  writerOutputSchema,
  editorOutputSchema,
  seoOutputSchema,
  plannerOutputSchema,
  // Types
  type ResearchOutput,
  type WriterOutput,
  type EditorOutput,
  type SeoOutput,
  type PlannerOutput,
  // Helpers
  validateAgentOutput,
  getValidationSummary,
  getSchemaForAgent,
  agentSchemaMap,
} from './validation';

export {
  extractJsonString,
  tryFixJson,
  safeJsonParse,
  sanitizeObject,
  redactSensitiveInfo,
  prepareForLogging,
  clampText,
} from './json-parser';

export {
  classifyError,
  createFailureMetadata,
  type FailureStage,
  type FailureType,
} from './failure-classification';
