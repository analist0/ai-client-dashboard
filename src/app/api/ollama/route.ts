/**
 * Ollama Management API
 *
 * GET  /api/ollama          — service status + model list
 * POST /api/ollama          — pull or delete a model
 *
 * Body for pull:   { action: 'pull',   model: 'llama3.2' }
 * Body for delete: { action: 'delete', model: 'llama3.2' }
 * Body for info:   { action: 'info',   model: 'llama3.2' }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectOllamaStatus,
  pullOllamaModel,
  deleteOllamaModel,
  getOllamaModelInfo,
} from '@/lib/llm/ollama';
import { createAdminClient } from '@/lib/supabase/client';

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

async function requireAdmin(req: NextRequest): Promise<{ id: string } | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? { id: user.id } : null;
}

// ── GET /api/ollama ──────────────────────────────────

export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = await detectOllamaStatus(OLLAMA_BASE_URL);
  return NextResponse.json(status);
}

// ── POST /api/ollama ─────────────────────────────────

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { action?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, model } = body;

  if (!action || !model) {
    return NextResponse.json(
      { error: 'action and model are required' },
      { status: 400 }
    );
  }

  // ── pull ──────────────────────────────────────────
  if (action === 'pull') {
    // For pull we use a streaming response so the client gets live progress
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
        };

        send({ status: 'starting', model });

        const result = await pullOllamaModel(
          OLLAMA_BASE_URL,
          model,
          (progress) => send(progress as unknown as Record<string, unknown>)
        );

        if (result.success) {
          send({ status: 'success', model });
        } else {
          send({ status: 'error', error: result.error, model });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // ── delete ────────────────────────────────────────
  if (action === 'delete') {
    const result = await deleteOllamaModel(OLLAMA_BASE_URL, model);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, model });
  }

  // ── info ──────────────────────────────────────────
  if (action === 'info') {
    const info = await getOllamaModelInfo(OLLAMA_BASE_URL, model);

    if (!info) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    return NextResponse.json(info);
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
