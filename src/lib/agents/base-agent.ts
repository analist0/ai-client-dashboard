/**
 * Base Agent Class
 * Abstract base class for all AI agents
 * 
 * Features:
 * - Provider-agnostic (OpenAI, Anthropic, Google, Ollama)
 * - Robust JSON parsing with multiple fallback strategies
 * - Zod schema validation
 * - Comprehensive error handling and logging
 * - Token usage tracking
 */

import { generateText, type ModelMessage as CoreMessage } from 'ai';
import { createOpenAI, type OpenAIProviderSettings } from '@ai-sdk/openai';
import { createAnthropic, type AnthropicProviderSettings } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderSettings } from '@ai-sdk/google';
import { createXai, type XaiProviderSettings } from '@ai-sdk/xai';
import type {
  AgentConfig,
  AgentInput,
  AgentOutput,
  LLMProvider,
  TokenUsage,
  JobLog,
} from '@/types';
import {
  callOllamaChat,
  safeJsonParse,
  sanitizeObject,
  prepareForLogging,
  getSchemaForAgent,
  validateAgentOutput,
  getValidationSummary,
  classifyError,
} from '@/lib/llm';

// =====================================================
// PROVIDER CONFIGURATION
// =====================================================

type ProviderClient =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createGoogleGenerativeAI>
  | ReturnType<typeof createXai>;

/**
 * Get the AI provider client based on configuration
 */
function getProviderClient(
  provider: LLMProvider,
  config?: Record<string, string>
): ProviderClient {
  switch (provider) {
    case 'openai': {
      const settings: OpenAIProviderSettings = {
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
        baseURL: config?.baseURL || process.env.OPENAI_BASE_URL,
      };
      return createOpenAI(settings);
    }
    case 'anthropic': {
      const settings: AnthropicProviderSettings = {
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
      };
      return createAnthropic(settings);
    }
    case 'google': {
      const settings: GoogleGenerativeAIProviderSettings = {
        apiKey: config?.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      };
      return createGoogleGenerativeAI(settings);
    }
    case 'xai': {
      const settings: XaiProviderSettings = {
        apiKey: config?.apiKey || process.env.XAI_API_KEY,
      };
      return createXai(settings);
    }
    case 'ollama': {
      // Ollama uses OpenAI-compatible API via HTTP
      const settings: OpenAIProviderSettings = {
        apiKey: config?.apiKey || 'ollama',
        baseURL: config?.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      };
      return createOpenAI(settings);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get the model identifier in provider format
 */
function getModelId(provider: LLMProvider, model: string): string {
  switch (provider) {
    case 'openai':
      return model.startsWith('gpt-') ? model : `openai:${model}`;
    case 'anthropic':
      return model.startsWith('claude-') ? model : `anthropic:${model}`;
    case 'google':
      return model;
    case 'xai':
      return model.startsWith('grok-') ? model : `grok-${model}`;
    case 'ollama':
      return model;
    default:
      return model;
  }
}

// =====================================================
// DEFAULTS FROM ENV
// =====================================================

const DEFAULT_PROVIDER = (process.env.DEFAULT_LLM_PROVIDER || 'openai') as LLMProvider;
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini';

// =====================================================
// BASE AGENT CLASS
// =====================================================

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected logs: JobLog[] = [];

  constructor(config: AgentConfig) {
    this.config = {
      ...config,
      provider: config.provider || DEFAULT_PROVIDER,
      model: config.model || DEFAULT_MODEL,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      timeoutMs: config.timeoutMs ?? 120000,
    };
  }

  /**
   * Get the agent name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Add a log entry
   */
  protected log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  /**
   * Get all logs
   */
  getLogs(): JobLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Execute the agent with the given input
   * This is the main entry point for agent execution
   */
  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      this.log('info', `Starting ${this.config.name} agent`, {
        taskId: input.taskId,
        inputData: prepareForLogging(input.inputData, 1000),
      });

      // Validate input
      this.validateInput(input);

      // Build messages
      const messages = await this.buildMessages(input);

      // Execute LLM call
      const result = await this.callLLM(messages);

      // Parse and validate output
      const parsedOutput = await this.parseOutput(result.output, input);

      const executionTime = Date.now() - startTime;

      this.log('info', `Agent execution completed`, {
        executionTimeMs: executionTime,
        tokenUsage: result.tokenUsage,
      });

      return {
        success: true,
        data: parsedOutput,
        summary: result.summary,
        metadata: {
          tokenUsage: result.tokenUsage,
          executionTimeMs: executionTime,
          model: this.config.model,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const { stage: failure_stage, type: failure_type } = classifyError(error);
      const error_message = error instanceof Error ? error.message : String(error);

      this.log('error', `Agent execution failed`, {
        error: error_message,
        executionTimeMs: executionTime,
        failureStage: failure_stage,
        failureType: failure_type,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        data: {},
        error: error_message,
        metadata: {
          executionTimeMs: executionTime,
          model: this.config.model,
          failureStage: failure_stage,
          failureType: failure_type,
        },
      };
    }
  }

  /**
   * Validate input data
   * Override in subclasses for specific validation
   */
  protected validateInput(input: AgentInput): void {
    if (!input.taskId) {
      throw new Error('Task ID is required');
    }
    if (!input.inputData || Object.keys(input.inputData).length === 0) {
      throw new Error('Input data is required');
    }
  }

  /**
   * Build messages for the LLM
   * Override in subclasses for custom message structure
   */
  protected async buildMessages(input: AgentInput): Promise<CoreMessage[]> {
    const systemPrompt = this.config.systemPrompt || this.getDefaultSystemPrompt();
    
    const userPrompt = await this.buildUserPrompt(input);

    const messages: CoreMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    // Add previous outputs if available
    if (input.previousOutputs && input.previousOutputs.length > 0) {
      for (const prevOutput of input.previousOutputs) {
        messages.push({
          role: 'assistant',
          content: prevOutput.summary || JSON.stringify(prevOutput.data),
        });
      }
    }

    return messages;
  }

  /**
   * Build the user prompt from input data
   * Override in subclasses for custom prompt building
   */
  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    // Default implementation: stringify input data
    return JSON.stringify(input.inputData, null, 2);
  }

  /**
   * Get the default system prompt
   * Override in subclasses for agent-specific prompts
   */
  protected getDefaultSystemPrompt(): string {
    return `You are an AI assistant helping with task execution. 
Provide clear, structured, and useful outputs.
Always respond with valid JSON when structured output is expected.`;
  }

  /**
   * Call the LLM with the given messages
   */
  protected async callLLM(messages: CoreMessage[]): Promise<{
    output: string;
    summary?: string;
    tokenUsage?: TokenUsage;
  }> {
    const provider = this.config.provider;

    // Special handling for Ollama
    if (provider === 'ollama') {
      return this.callOllama(messages);
    }

    // Use AI SDK for other providers
    const providerClient = getProviderClient(provider);
    const modelId = getModelId(provider, this.config.model);
    const model = providerClient(modelId);

    try {
      const result = await generateText({
        model,
        messages,
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      });

      return {
        output: result.text,
        summary: result.text.substring(0, 500), // First 500 chars as summary
        tokenUsage: {
          prompt_tokens: result.usage?.inputTokens || 0,
          completion_tokens: result.usage?.outputTokens || 0,
          total_tokens: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0),
        },
      };
    } catch (error) {
      this.log('error', 'LLM call failed', {
        provider,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Call Ollama directly via HTTP
   */
  private async callOllama(messages: CoreMessage[]): Promise<{
    output: string;
    summary?: string;
    tokenUsage?: TokenUsage;
  }> {
    const baseURL = this.config.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';

    try {
      const result = await callOllamaChat({
        baseURL,
        model: this.config.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        timeout: this.config.timeoutMs,
      });

      return {
        output: result.output,
        summary: result.output.substring(0, 500),
        tokenUsage: result.tokenUsage,
      };
    } catch (error) {
      this.log('error', 'Ollama call failed', {
        model: this.config.model,
        baseURL,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Parse the LLM output into structured data
   * Uses robust JSON extraction and Zod validation
   */
  protected async parseOutput(
    output: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _input: AgentInput
  ): Promise<Record<string, unknown>> {
    const agentSchema = getSchemaForAgent(this.config.name);
    
    // Get fallback based on agent type
    const fallback = this.getFallbackOutput();

    // Try to parse JSON with multiple strategies
    const parseResult = safeJsonParse<Record<string, unknown>>(output, fallback);

    if (!parseResult.success) {
      this.log('warn', 'JSON parsing failed, using fallback', {
        error: parseResult.error,
        rawOutputLength: output.length,
      });

      return {
        ...fallback,
        raw: true,
        parse_error: parseResult.error,
        raw_output: output.substring(0, 2000),
      };
    }

    // Sanitize to prevent prototype pollution
    const sanitized = sanitizeObject<Record<string, unknown>>(parseResult.data);

    // Validate against schema if available
    if (agentSchema) {
      const validation = validateAgentOutput(agentSchema, sanitized, fallback);
      
      if (!validation.valid) {
        this.log('warn', 'Schema validation failed', {
          errors: getValidationSummary(validation.errors),
        });

        return {
          ...(validation.data as Record<string, unknown>),
          schema_valid: false,
          schema_errors: getValidationSummary(validation.errors),
        };
      }

      return validation.data as Record<string, unknown>;
    }

    return sanitized;
  }

  /**
   * Get fallback output for when parsing fails
   * Override in subclasses for type-specific fallbacks
   */
  protected getFallbackOutput(): Record<string, unknown> {
    return {
      content: 'Failed to parse structured output',
      raw: true,
    };
  }
}

// =====================================================
// AGENT REGISTRY
// =====================================================

type AgentConstructor = new (config: AgentConfig) => BaseAgent;

const agentRegistry = new Map<string, AgentConstructor>();

/**
 * Register an agent class
 */
export function registerAgent(name: string, constructor: AgentConstructor): void {
  agentRegistry.set(name.toLowerCase(), constructor);
}

/**
 * Get an agent instance by name
 */
export function getAgent(name: string, config: Partial<AgentConfig>): BaseAgent {
  const Constructor = agentRegistry.get(name.toLowerCase());
  if (!Constructor) {
    throw new Error(`Unknown agent: ${name}. Available agents: ${Array.from(agentRegistry.keys()).join(', ')}`);
  }

  return new Constructor({
    name,
    provider: config.provider || DEFAULT_PROVIDER,
    model: config.model || DEFAULT_MODEL,
    systemPrompt: config.systemPrompt || '',
    ...config,
  });
}

/**
 * Get all registered agent names
 */
export function getAvailableAgents(): string[] {
  return Array.from(agentRegistry.keys());
}

/**
 * Check if an agent is registered
 */
export function hasAgent(name: string): boolean {
  return agentRegistry.has(name.toLowerCase());
}
