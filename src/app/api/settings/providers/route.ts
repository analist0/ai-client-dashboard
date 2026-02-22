/**
 * GET /api/settings/providers
 * Returns status of all LLM providers (env vars + Ollama detection)
 */

import { NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function GET() {
  const providers = {
    openai: {
      name: 'OpenAI',
      configured: !!process.env.OPENAI_API_KEY,
      keyPrefix: process.env.OPENAI_API_KEY
        ? process.env.OPENAI_API_KEY.substring(0, 7) + '...'
        : null,
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    },
    anthropic: {
      name: 'Anthropic (Claude)',
      configured: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.substring(0, 7) + '...'
        : null,
      models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
    },
    google: {
      name: 'Google AI (Gemini)',
      configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      keyPrefix: process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? process.env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 7) + '...'
        : null,
      models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    },
    xai: {
      name: 'xAI (Grok)',
      configured: !!process.env.XAI_API_KEY,
      keyPrefix: process.env.XAI_API_KEY
        ? process.env.XAI_API_KEY.substring(0, 7) + '...'
        : null,
      models: ['grok-3', 'grok-3-mini', 'grok-2'],
    },
  };

  // Detect Ollama
  let ollama = {
    running: false,
    version: null as string | null,
    models: [] as { name: string; size: number; modified: string }[],
    baseUrl: OLLAMA_BASE_URL,
  };

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);

    const [versionRes, modelsRes] = await Promise.all([
      fetch(`${OLLAMA_BASE_URL}/api/version`, { signal: controller.signal }),
      fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal }),
    ]);

    if (versionRes.ok && modelsRes.ok) {
      const versionData = await versionRes.json();
      const modelsData = await modelsRes.json();

      ollama = {
        running: true,
        version: versionData.version || null,
        models: (modelsData.models || []).map((m: Record<string, unknown>) => ({
          name: String(m.name),
          size: Number(m.size),
          modified: String(m.modified_at),
        })),
        baseUrl: OLLAMA_BASE_URL,
      };
    }
  } catch {
    // Ollama not running or not reachable
  }

  return NextResponse.json({ providers, ollama });
}
