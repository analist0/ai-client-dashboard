/**
 * Settings Page - User profile and preferences
 */

'use client';

import { useState, useEffect } from 'react';
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

export default function SettingsPage() {
  const { user, updateProfile, loading } = useAuth();
  const { locale: currentLocale, setLocale } = useLocale();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguage] = useState<Locale>('en');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Populate form once user loads
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setCompanyName(user.company_name || '');
      setTimezone(user.timezone || 'UTC');
      setLanguage((user.language as Locale) || currentLocale);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const result = await updateProfile({
      full_name: fullName.trim() || undefined,
      company_name: companyName.trim() || undefined,
      timezone,
      language,
    });

    setSaving(false);
    if (result.success) {
      // Apply locale change immediately
      if (language !== currentLocale) {
        setLocale(language);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Failed to save');
    }
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
          <p className="text-sm text-gray-500 mt-1">Manage your profile and preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  Profile saved successfully!
                </div>
              )}

              {/* Avatar placeholder */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
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
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Your company"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Locale)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    {locales.map((l) => (
                      <option key={l} value={l}>
                        {localeFlags[l]} {localeNames[l]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" isLoading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Account</CardTitle>
          </CardHeader>
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
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Provider Keys */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">AI Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {[
                { name: 'xAI (Grok)', env: 'XAI_API_KEY', configured: true },
                { name: 'Anthropic (Claude)', env: 'ANTHROPIC_API_KEY', configured: false },
                { name: 'OpenAI', env: 'OPENAI_API_KEY', configured: false },
                { name: 'Google AI', env: 'GOOGLE_GENERATIVE_AI_API_KEY', configured: false },
              ].map((provider) => (
                <div key={provider.name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{provider.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    provider.configured
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {provider.configured ? 'Configured' : 'Not set'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Configure API keys in your <code className="bg-gray-100 px-1 rounded">.env.local</code> file.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
