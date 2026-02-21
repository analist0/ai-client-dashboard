'use client';

/**
 * OllamaManager
 *
 * Displays Ollama service status, installed models, and allows:
 * - Pulling new models with live progress
 * - Deleting installed models
 * - Showing install instructions when service is unavailable
 */

import { useState, useEffect, useCallback } from 'react';
import type { OllamaStatus, OllamaModelDetails } from '@/lib/llm/ollama';

// =====================================================
// HELPERS
// =====================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({ status }: { status: OllamaStatus['status'] }) {
  const config = {
    running: { dot: 'bg-green-400', text: 'Running', badge: 'bg-green-50 text-green-700 ring-green-600/20' },
    unreachable: { dot: 'bg-yellow-400', text: 'Unreachable', badge: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' },
    not_installed: { dot: 'bg-red-400', text: 'Not installed', badge: 'bg-red-50 text-red-700 ring-red-600/20' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.text}
    </span>
  );
}

// =====================================================
// INSTALL INSTRUCTIONS PANEL
// =====================================================

function InstallPanel({ instructions }: { instructions: NonNullable<OllamaStatus['installInstructions']> }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📦</span>
        <h3 className="font-semibold text-amber-900">Ollama is not running</h3>
      </div>

      <p className="text-sm text-amber-800">
        Install Ollama on <strong>{instructions.os}</strong> to run local AI models privately — no API key needed.
      </p>

      <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800">
        {instructions.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {instructions.command && (
        <pre className="rounded-lg bg-amber-900/10 px-4 py-2.5 text-xs font-mono text-amber-900 overflow-x-auto">
          {instructions.command}
        </pre>
      )}

      {instructions.note && (
        <p className="text-xs text-amber-700 italic">{instructions.note}</p>
      )}

      <a
        href={instructions.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
      >
        Download Ollama
        <span>↗</span>
      </a>
    </div>
  );
}

// =====================================================
// MODEL ROW
// =====================================================

function ModelRow({
  model,
  onDelete,
}: {
  model: OllamaModelDetails;
  onDelete: (name: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-gray-900 text-sm">{model.name}</div>
        {model.details?.family && (
          <div className="text-xs text-gray-500">{model.details.family}</div>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {model.details?.parameter_size || '—'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {model.details?.quantization_level || '—'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {formatBytes(model.size)}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {formatDate(model.modified_at)}
      </td>
      <td className="py-3 px-4 text-right">
        {confirming ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-gray-500">Delete?</span>
            <button
              onClick={() => { onDelete(model.name); setConfirming(false); }}
              className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

// =====================================================
// PULL PANEL
// =====================================================

const POPULAR_MODELS = [
  { name: 'llama3.2', label: 'Llama 3.2 3B', size: '~2 GB' },
  { name: 'llama3.2:1b', label: 'Llama 3.2 1B', size: '~800 MB' },
  { name: 'mistral', label: 'Mistral 7B', size: '~4 GB' },
  { name: 'gemma3:4b', label: 'Gemma 3 4B', size: '~3 GB' },
  { name: 'qwen2.5:3b', label: 'Qwen 2.5 3B', size: '~2 GB' },
  { name: 'phi4-mini', label: 'Phi-4 Mini', size: '~2.5 GB' },
  { name: 'deepseek-r1:7b', label: 'DeepSeek R1 7B', size: '~4 GB' },
  { name: 'nomic-embed-text', label: 'Nomic Embed (embeddings)', size: '~274 MB' },
];

interface PullState {
  status: 'idle' | 'pulling' | 'success' | 'error';
  lines: string[];
  percent?: number;
  error?: string;
}

function PullPanel({ onPulled }: { onPulled: () => void }) {
  const [modelInput, setModelInput] = useState('');
  const [pull, setPull] = useState<PullState>({ status: 'idle', lines: [] });

  const startPull = useCallback(async (modelName: string) => {
    const name = modelName.trim();
    if (!name) return;

    setPull({ status: 'pulling', lines: [`Starting pull: ${name}…`] });

    try {
      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', model: name }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as {
              status?: string;
              percent?: number;
              error?: string;
            };

            if (data.status === 'error') {
              setPull((p) => ({ ...p, status: 'error', error: data.error }));
              return;
            }
            if (data.status === 'success') {
              setPull((p) => ({ ...p, status: 'success', lines: [...p.lines, 'Done!'] }));
              onPulled();
              return;
            }

            setPull((p) => ({
              ...p,
              percent: data.percent ?? p.percent,
              lines: [
                ...p.lines.slice(-8),
                data.percent != null
                  ? `${data.status} — ${data.percent}%`
                  : (data.status ?? ''),
              ],
            }));
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      setPull((p) => ({ ...p, status: 'error', error: String(err) }));
    }
  }, [onPulled]);

  return (
    <div className="space-y-4">
      {/* Popular presets */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Popular models</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_MODELS.map((m) => (
            <button
              key={m.name}
              onClick={() => setModelInput(m.name)}
              className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:border-blue-400 hover:text-blue-700 transition-colors"
              title={m.size}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={modelInput}
          onChange={(e) => setModelInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && startPull(modelInput)}
          placeholder="e.g. llama3.2, mistral:7b-instruct"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={pull.status === 'pulling'}
        />
        <button
          onClick={() => startPull(modelInput)}
          disabled={!modelInput.trim() || pull.status === 'pulling'}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pull.status === 'pulling' ? 'Pulling…' : 'Pull'}
        </button>
      </div>

      {/* Progress */}
      {pull.status === 'pulling' && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
          {pull.percent != null && (
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${pull.percent}%` }}
              />
            </div>
          )}
          <div className="font-mono text-xs text-blue-800 space-y-0.5 max-h-24 overflow-y-auto">
            {pull.lines.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {pull.status === 'success' && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          Model pulled successfully!
        </div>
      )}

      {pull.status === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {pull.error}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function OllamaManager() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ollama');
      const data: OllamaStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        status: 'not_installed',
        baseURL: 'http://localhost:11434',
        models: [],
        modelCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleDelete = useCallback(async (modelName: string) => {
    setDeleting(modelName);
    try {
      await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', model: modelName }),
      });
      await fetchStatus();
    } finally {
      setDeleting(null);
    }
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 rounded-xl bg-gray-100" />
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-6">

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xl">
              🦙
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-gray-900">Ollama</h2>
                <StatusBadge status={status.status} />
              </div>
              <p className="text-xs text-gray-500">
                {status.status === 'running'
                  ? `${status.baseURL} · ${status.modelCount} model${status.modelCount !== 1 ? 's' : ''} installed${status.version ? ` · v${status.version}` : ''}`
                  : status.baseURL}
              </p>
            </div>
          </div>
          <button
            onClick={fetchStatus}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
          >
            <span className="text-base">↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Install instructions */}
      {status.status !== 'running' && status.installInstructions && (
        <InstallPanel instructions={status.installInstructions} />
      )}

      {/* Running — model table + pull */}
      {status.status === 'running' && (
        <>
          {/* Model list */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 text-sm">Installed models</h3>
              <span className="text-xs text-gray-400">{status.modelCount} total</span>
            </div>

            {status.models.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No models installed — pull one below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="text-left py-2.5 px-4">Model</th>
                      <th className="text-left py-2.5 px-4">Params</th>
                      <th className="text-left py-2.5 px-4">Quant</th>
                      <th className="text-left py-2.5 px-4">Size</th>
                      <th className="text-left py-2.5 px-4">Modified</th>
                      <th className="py-2.5 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {status.models.map((model) => (
                      <ModelRow
                        key={model.name}
                        model={model}
                        onDelete={handleDelete}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pull panel */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="font-medium text-gray-900 text-sm">Pull a model</h3>
            <PullPanel onPulled={fetchStatus} />
          </div>
        </>
      )}

      {/* Unreachable hint */}
      {status.status === 'unreachable' && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800 space-y-2">
          <p className="font-medium">Ollama is installed but not responding</p>
          <p>Start the service and refresh:</p>
          <pre className="rounded bg-yellow-900/10 px-3 py-2 text-xs font-mono">ollama serve</pre>
        </div>
      )}
    </div>
  );
}
