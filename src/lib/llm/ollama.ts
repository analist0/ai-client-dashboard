/**
 * Ollama HTTP Client
 * Direct HTTP API client for Ollama (no npm package needed)
 *
 * Ollama provides an OpenAI-compatible API at /v1/chat/completions
 * as well as its native /api endpoints for model management.
 */

// Minimal message shape used by Ollama chat (compatible with ai SDK v6)
type Message = { role: string; content: string };

// =====================================================
// TYPES
// =====================================================

export interface OllamaConfig {
  baseURL: string;
  model: string;
  timeout?: number;
}

export interface OllamaResponse {
  model: string;
  response?: string;
  message?: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OllamaModelDetails {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export type OllamaServiceStatus =
  | 'running'      // Ollama is reachable and healthy
  | 'unreachable'  // Port is closed / connection refused
  | 'not_installed'; // Cannot determine, likely not installed

export interface OllamaStatus {
  status: OllamaServiceStatus;
  version?: string;
  baseURL: string;
  models: OllamaModelDetails[];
  modelCount: number;
  installInstructions?: OllamaInstallInstructions;
}

export interface OllamaInstallInstructions {
  os: string;
  steps: string[];
  command?: string;
  url: string;
  note?: string;
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
}

// =====================================================
// HELPERS
// =====================================================

function getBaseURL(urlOrConfig: string): string {
  return urlOrConfig.endsWith('/v1')
    ? urlOrConfig.replace('/v1', '')
    : urlOrConfig;
}

// =====================================================
// SERVICE DETECTION
// =====================================================

/**
 * Detect the Ollama service status with full details.
 * Returns status, version, installed models, and install instructions if needed.
 */
export async function detectOllamaStatus(
  baseURL: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
): Promise<OllamaStatus> {
  const base = getBaseURL(baseURL);

  try {
    // Try /api/version first — most reliable health probe
    const versionRes = await fetch(`${base}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!versionRes.ok) {
      return {
        status: 'unreachable',
        baseURL: base,
        models: [],
        modelCount: 0,
        installInstructions: getInstallInstructions(),
      };
    }

    const versionData = await versionRes.json() as { version?: string };

    // Fetch model list
    const models = await listOllamaModelDetails(base);

    return {
      status: 'running',
      version: versionData.version,
      baseURL: base,
      models,
      modelCount: models.length,
    };
  } catch {
    // Connection refused or timeout → service not running / not installed
    return {
      status: 'not_installed',
      baseURL: base,
      models: [],
      modelCount: 0,
      installInstructions: getInstallInstructions(),
    };
  }
}

/**
 * Simple boolean health check — used by worker before each job.
 */
export async function checkOllamaHealth(baseURL: string): Promise<boolean> {
  try {
    const base = getBaseURL(baseURL);
    const response = await fetch(`${base}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// =====================================================
// MODEL MANAGEMENT
// =====================================================

/**
 * List all locally installed models with full details.
 */
export async function listOllamaModelDetails(
  baseURL: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
): Promise<OllamaModelDetails[]> {
  try {
    const base = getBaseURL(baseURL);
    const response = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = await response.json() as { models?: OllamaModelDetails[] };
    return data.models ?? [];
  } catch {
    return [];
  }
}

/**
 * @deprecated Use listOllamaModelDetails instead.
 */
export async function listOllamaModels(baseURL: string): Promise<string[]> {
  const models = await listOllamaModelDetails(baseURL);
  return models.map((m) => m.name);
}

/**
 * Get detailed info for a single model (parameters, template, etc.)
 */
export async function getOllamaModelInfo(
  baseURL: string,
  modelName: string
): Promise<Record<string, unknown> | null> {
  try {
    const base = getBaseURL(baseURL);
    const response = await fetch(`${base}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    return await response.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Pull (download) a model from the Ollama registry.
 * Calls onProgress with live progress updates.
 * Returns true on success, false on failure.
 */
export async function pullOllamaModel(
  baseURL: string,
  modelName: string,
  onProgress?: (progress: OllamaPullProgress) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const base = getBaseURL(baseURL);
    const response = await fetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal: AbortSignal.timeout(30 * 60 * 1000), // 30 min for large models
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `Pull failed: ${response.status} ${err}` };
    }

    // Stream NDJSON progress lines
    const reader = response.body?.getReader();
    if (!reader) return { success: false, error: 'No response body' };

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress = JSON.parse(line) as {
            status: string;
            digest?: string;
            total?: number;
            completed?: number;
          };

          const percent =
            progress.total && progress.completed
              ? Math.round((progress.completed / progress.total) * 100)
              : undefined;

          onProgress?.({ ...progress, percent });
        } catch {
          // Ignore malformed lines
        }
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Delete a locally installed model.
 */
export async function deleteOllamaModel(
  baseURL: string,
  modelName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const base = getBaseURL(baseURL);
    const response = await fetch(`${base}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `Delete failed: ${response.status} ${err}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// =====================================================
// INSTALL INSTRUCTIONS
// =====================================================

/**
 * Returns installation instructions appropriate for the detected OS.
 * Runs server-side only (uses process.platform).
 */
export function getInstallInstructions(): OllamaInstallInstructions {
  // process.platform is only available server-side
  const platform =
    typeof process !== 'undefined' ? process.platform : 'unknown';

  if (platform === 'darwin') {
    return {
      os: 'macOS',
      url: 'https://ollama.com/download/mac',
      steps: [
        'Download the macOS app from ollama.com',
        'Open the downloaded .dmg and drag Ollama to Applications',
        'Launch Ollama from Applications',
        'Ollama runs as a menu bar app on port 11434',
      ],
      command: 'brew install ollama && ollama serve',
      note: 'Or install via Homebrew: brew install ollama',
    };
  }

  if (platform === 'win32') {
    return {
      os: 'Windows',
      url: 'https://ollama.com/download/windows',
      steps: [
        'Download the Windows installer from ollama.com',
        'Run OllamaSetup.exe',
        'Ollama starts automatically and runs on port 11434',
      ],
      note: 'Requires Windows 10 or later',
    };
  }

  // Linux (or unknown)
  return {
    os: 'Linux',
    url: 'https://ollama.com/download/linux',
    command: 'curl -fsSL https://ollama.com/install.sh | sh',
    steps: [
      'Run the install script:',
      '  curl -fsSL https://ollama.com/install.sh | sh',
      'Start the service: ollama serve',
      'Or enable as systemd service: systemctl enable --now ollama',
    ],
    note: 'Supports Ubuntu 20.04+, Debian 11+, Fedora 39+',
  };
}

// =====================================================
// INFERENCE
// =====================================================

/**
 * Call Ollama using the native /api/generate endpoint
 */
export async function callOllamaGenerate({
  baseURL,
  model,
  prompt,
  system,
  timeout = 120000,
}: {
  baseURL: string;
  model: string;
  prompt: string;
  system?: string;
  timeout?: number;
}): Promise<{
  output: string;
  tokenUsage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  executionTimeMs?: number;
}> {
  const startTime = Date.now();
  const base = getBaseURL(baseURL);
  const url = `${base}/api/generate`;

  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: fullPrompt, stream: false, options: { temperature: 0.7 } }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
    }

    const data: OllamaResponse = await response.json();

    return {
      output: data.response || data.message?.content || '',
      tokenUsage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      executionTimeMs: data.total_duration
        ? Math.round(data.total_duration / 1_000_000)
        : Date.now() - startTime,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Call Ollama using the OpenAI-compatible /v1/chat/completions endpoint
 */
export async function callOllamaChat({
  baseURL,
  model,
  messages,
  timeout = 120000,
}: {
  baseURL: string;
  model: string;
  messages: Message[];
  timeout?: number;
}): Promise<{
  output: string;
  tokenUsage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  executionTimeMs?: number;
}> {
  const startTime = Date.now();
  const base = getBaseURL(baseURL);
  const url = `${base}/v1/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama chat request failed: ${response.status} ${errorText}`);
    }

    const data: OllamaChatResponse = await response.json();
    const choice = data.choices[0];
    if (!choice) throw new Error('Ollama returned empty response');

    return {
      output: choice.message.content,
      tokenUsage: data.usage,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama chat request timed out after ${timeout}ms`);
    }
    throw error;
  }
}
