/**
 * Settings Page — Profile, Language, AI Providers, Ollama
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useLocale } from '@/providers/locale-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/locales';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Jerusalem', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderInfo {
  name: string;
  configured: boolean;
  keyPrefix: string | null;
  models: string[];
}

interface OllamaModel {
  name: string;
  size: number;
  modified: string;
}

interface ProvidersData {
  providers: Record<string, ProviderInfo>;
  ollama: {
    running: boolean;
    version: string | null;
    models: OllamaModel[];
    baseUrl: string;
  };
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🟢',
  anthropic: '🟣',
  google: '🔵',
  xai: '⚫',
};

const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xai: 'XAI_API_KEY',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, updateProfile, loading } = useAuth();
  const { locale: currentLocale, setLocale } = useLocale();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguage] = useState<Locale>('en');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [providersData, setProvidersData] = useState<ProvidersData | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);

  // Ollama pull state
  const [pullModel, setPullModel] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullLog, setPullLog] = useState<string[]>([]);

  // Populate profile form
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setCompanyName(user.company_name || '');
      setTimezone(user.timezone || 'UTC');
      setLanguage((user.language as Locale) || currentLocale);
    }
  }, [user, currentLocale]);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const res = await fetch('/api/settings/providers');
      if (res.ok) setProvidersData(await res.json());
    } catch {
      // ignore
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // Profile save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileError('');
    setSuccess(false);

    const result = await updateProfile({
      full_name: fullName.trim() || undefined,
      company_name: companyName.trim() || undefined,
      timezone,
      language,
    });

    setSaving(false);
    if (result.success) {
      if (language !== currentLocale) setLocale(language);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setProfileError(result.error || 'Failed to save');
    }
  };

  // Ollama: pull model
  const handlePullModel = async () => {
    if (!pullModel.trim() || pulling) return;
    setPulling(true);
    setPullLog([`Pulling ${pullModel}...`]);

    try {
      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', model: pullModel.trim() }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status) {
                setPullLog((prev) => [...prev.slice(-20), data.status + (data.completed && data.total ? ` (${Math.round(data.completed / data.total * 100)}%)` : '')]);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      setPullLog((prev) => [...prev, 'Done!']);
      setPullModel('');
      fetchProviders();
    } catch (err) {
      setPullLog((prev) => [...prev, `Error: ${err instanceof Error ? err.message : 'Failed'}`]);
    } finally {
      setPulling(false);
    }
  };

  // Ollama: delete model
  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Delete model "${modelName}"?`)) return;
    try {
      await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', model: modelName }),
      });
      fetchProviders();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your profile and AI providers</p>
        </div>

        {/* ── Profile ── */}
        <Card>
          <CardHeader><CardTitle as="h2">Profile</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{profileError}</div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  Profile saved!
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600">
                  {(fullName || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role || 'client'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Your company"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as Locale)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                    {locales.map((l) => (
                      <option key={l} value={l}>{localeFlags[l]} {localeNames[l]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button type="submit" variant="primary" isLoading={saving}>Save Changes</Button>
            </form>
          </CardContent>
        </Card>

        {/* ── AI Providers ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle as="h2">AI Providers</CardTitle>
              <button
                onClick={fetchProviders}
                disabled={providersLoading}
                className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {providersLoading ? 'Checking...' : '↻ Refresh'}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {providersLoading && !providersData ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {providersData && Object.entries(providersData.providers).map(([key, provider]) => (
                  <ProviderRow key={key} providerKey={key} provider={provider} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Ollama ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle as="h2">Ollama (Local LLM)</CardTitle>
              {providersData?.ollama.running ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Running {providersData.ollama.version ? `v${providersData.ollama.version}` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Not detected
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!providersData?.ollama.running ? (
              <div className="text-sm text-gray-500 space-y-2">
                <p>Ollama is not running at <code className="bg-gray-100 px-1 rounded text-xs">{providersData?.ollama.baseUrl || 'http://localhost:11434'}</code></p>
                <p>Install Ollama from <span className="text-blue-600">ollama.ai</span> and run <code className="bg-gray-100 px-1 rounded text-xs">ollama serve</code> to use local models.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Installed models */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Installed Models ({providersData.ollama.models.length})
                  </p>
                  {providersData.ollama.models.length === 0 ? (
                    <p className="text-sm text-gray-500">No models installed. Pull one below.</p>
                  ) : (
                    <div className="space-y-2">
                      {providersData.ollama.models.map((model) => (
                        <div key={model.name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{model.name}</p>
                            <p className="text-xs text-gray-400">{formatBytes(model.size)}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteModel(model.name)}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pull new model */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Pull a Model</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pullModel}
                      onChange={(e) => setPullModel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
                      placeholder="e.g. llama3.2, mistral, phi3"
                      disabled={pulling}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
                    />
                    <Button variant="primary" onClick={handlePullModel} isLoading={pulling}>
                      Pull
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Popular: llama3.2, mistral, phi3, gemma3, qwen2.5
                  </p>
                  {pullLog.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-900 rounded-lg font-mono text-xs text-green-400 max-h-32 overflow-y-auto">
                      {pullLog.map((line, i) => <div key={i}>{line}</div>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Account Info ── */}
        <Card>
          <CardHeader><CardTitle as="h2">Account</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Role</span>
                <span className="font-medium text-gray-900 capitalize">{user?.role || 'client'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Member since</span>
                <span className="font-medium text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ─── Provider Row Component ───────────────────────────────────────────────────

function ProviderRow({ providerKey, provider }: { providerKey: string; provider: ProviderInfo }) {
  const [showModels, setShowModels] = useState(false);
  const envKey = PROVIDER_ENV_KEYS[providerKey] || '';
  const icon = PROVIDER_ICONS[providerKey] || '🔌';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <div>
            <p className="text-sm font-medium text-gray-900">{provider.name}</p>
            {provider.configured && provider.keyPrefix && (
              <p className="text-xs text-gray-400 font-mono">{provider.keyPrefix}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {provider.configured ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Configured
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Not set
            </span>
          )}
          {provider.configured && (
            <button
              onClick={() => setShowModels(!showModels)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showModels ? '▲' : '▼'} Models
            </button>
          )}
        </div>
      </div>

      {!provider.configured && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Add to your <code className="bg-white px-1 rounded border border-gray-200">.env.local</code>:</p>
          <code className="block text-xs bg-gray-900 text-green-400 px-3 py-2 rounded select-all">
            {envKey}=your_key_here
          </code>
        </div>
      )}

      {provider.configured && showModels && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {provider.models.map((model) => (
              <span key={model} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-mono">
                {model}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
