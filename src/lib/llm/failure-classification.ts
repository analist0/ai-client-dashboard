/**
 * Failure Classification Types
 * Every error must be classified by stage and type
 */

/**
 * Stage where failure occurred
 */
export type FailureStage = 
  | 'llm_call'      // Failed to call LLM API
  | 'parse'         // Failed to parse LLM output
  | 'validation'    // Failed schema validation
  | 'timeout'       // Job timed out
  | 'input'         // Invalid input data
  | 'workflow'      // Workflow execution error
  | 'unknown';      // Unclassified

/**
 * Type of failure
 */
export type FailureType =
  | 'timeout'           // Operation exceeded time limit
  | 'network'           // Network/connection error
  | 'rate_limit'        // API rate limit exceeded
  | 'invalid_input'     // Input data malformed
  | 'schema_mismatch'   // Output doesn't match schema
  | 'invalid_json'      // LLM returned non-JSON
  | 'authentication'    // API auth failed
  | 'model_error'       // Model unavailable/error
  | 'content_filter'    // Content blocked by filter
  | 'quota_exceeded'    // API quota exceeded
  | 'internal_error'    // Server-side error
  | 'unknown';          // Unclassified

/**
 * Classify error to stage and type
 */
export function classifyError(error: unknown): { stage: FailureStage; type: FailureType } {
  if (!(error instanceof Error)) {
    return { stage: 'unknown', type: 'unknown' };
  }

  const message = error.message.toLowerCase();

  // Timeout detection
  if (message.includes('timeout') || message.includes('timed out')) {
    return { stage: 'timeout', type: 'timeout' };
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('enetunreach') ||
    message.includes('econnrefused') ||
    message.includes('econnreset')
  ) {
    return { stage: 'llm_call', type: 'network' };
  }

  // Rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests')
  ) {
    return { stage: 'llm_call', type: 'rate_limit' };
  }

  // Authentication
  if (
    message.includes('auth') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('api key')
  ) {
    return { stage: 'llm_call', type: 'authentication' };
  }

  // Model errors
  if (
    message.includes('model') ||
    message.includes('404') ||
    message.includes('not found')
  ) {
    return { stage: 'llm_call', type: 'model_error' };
  }

  // Content filter
  if (
    message.includes('content') ||
    message.includes('filter') ||
    message.includes('policy') ||
    message.includes('blocked')
  ) {
    return { stage: 'llm_call', type: 'content_filter' };
  }

  // Quota
  if (
    message.includes('quota') ||
    message.includes('limit exceeded') ||
    message.includes('billing')
  ) {
    return { stage: 'llm_call', type: 'quota_exceeded' };
  }

  // JSON parsing
  if (
    message.includes('json') ||
    message.includes('parse') ||
    message.includes('syntax')
  ) {
    return { stage: 'parse', type: 'invalid_json' };
  }

  // Schema validation
  if (
    message.includes('schema') ||
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('mismatch')
  ) {
    return { stage: 'validation', type: 'schema_mismatch' };
  }

  // Input validation
  if (
    message.includes('input') ||
    message.includes('required') ||
    message.includes('missing')
  ) {
    return { stage: 'input', type: 'invalid_input' };
  }

  // Internal server errors from API
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return { stage: 'llm_call', type: 'internal_error' };
  }

  // Default
  return { stage: 'unknown', type: 'unknown' };
}

/**
 * Create error metadata for logging/storage
 */
export function createFailureMetadata(
  error: unknown,
  stage?: FailureStage
): {
  error_message: string;
  failure_stage: FailureStage;
  failure_type: FailureType;
} {
  const classification = classifyError(error);
  
  return {
    error_message: error instanceof Error ? error.message : String(error),
    failure_stage: stage || classification.stage,
    failure_type: classification.type,
  };
}
