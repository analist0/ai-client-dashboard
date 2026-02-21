/**
 * Health Check Endpoint
 * GET /api/health
 *
 * Returns worker + DB connectivity status.
 * Safe to expose publicly — returns no secrets.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function dbClient() {
  // Use service role key if available, fall back to anon key for read-only health check
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const start = Date.now();

  try {
    const supabase = dbClient();

    // Lightweight DB ping
    const { error } = await supabase
      .from('ai_jobs')
      .select('id')
      .eq('status', 'running')
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: 'degraded', error: error.message, latencyMs: Date.now() - start },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', error: String(err), latencyMs: Date.now() - start },
      { status: 503 }
    );
  }
}
