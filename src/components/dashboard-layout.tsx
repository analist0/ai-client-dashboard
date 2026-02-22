/**
 * Dashboard Layout — Fully RTL/LTR responsive sidebar
 *
 * RTL strategy: Tailwind logical properties (start/end/ps/pe/ms/me)
 * flip automatically when <html dir="rtl"> is set by the locale provider.
 * Physical transforms (translate-x) use ltr:/rtl: variants explicitly.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/helpers';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useLocale } from '@/providers/locale-provider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/locales';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// ── Icons ─────────────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
  </svg>
);

const IconProjects = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const IconTasks = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const IconDeliverables = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconAILogs = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const IconSettings = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconAdmin = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconGlobe = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const IconChevronDown = () => (
  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

const IconMenu = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const IconSignOut = () => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-4 h-4 shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { locale, setLocale } = useLocale();

  const navItems: NavItem[] = [
    { labelKey: 'dashboard',    href: '/dashboard',      icon: <IconDashboard /> },
    { labelKey: 'projects',     href: '/projects',       icon: <IconProjects /> },
    { labelKey: 'tasks',        href: '/tasks',          icon: <IconTasks /> },
    { labelKey: 'deliverables', href: '/deliverables',   icon: <IconDeliverables /> },
    { labelKey: 'aiLogs',       href: '/ai-logs',        icon: <IconAILogs /> },
  ];

  if (user?.role === 'admin') {
    navItems.push({ labelKey: 'admin', href: '/admin/projects', icon: <IconAdmin /> });
  }

  const settingsActive = pathname === '/settings';

  // ── Nav item style ────────────────────────────────────────────────
  const navItemClass = (active: boolean) =>
    cn(
      'group flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-medium',
      'border-s-[3px] transition-all duration-150',
      active
        ? 'border-blue-500 bg-blue-50 text-blue-700'
        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-200'
    );

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* ── Mobile overlay ──────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      {/*
          Logical properties used throughout:
          - start-0  = left in LTR, right in RTL
          - border-e = right border in LTR, left border in RTL
          Physical transforms need explicit ltr:/rtl: variants:
          - Closed LTR: -translate-x-full (slides off to the left)
          - Closed RTL:  translate-x-full (slides off to the right)
      */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex flex-col w-64',
          'bg-white border-e border-gray-200/80 shadow-sm',
          'transition-transform duration-300 ease-in-out',
          // Desktop: always visible. max-lg variants are mutually exclusive
          // with lg:translate-x-0, so there is no CSS cascade conflict.
          'lg:translate-x-0',
          sidebarOpen
            ? 'translate-x-0'
            : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200">
            <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">AI Dashboard</p>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase leading-tight">
              Client Portal
            </p>
          </div>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={navItemClass(isActive)}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    'transition-colors duration-150',
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  )}>
                    {item.icon}
                  </span>
                  <span className="truncate">
                    {t(item.labelKey as Parameters<typeof t>[0])}
                  </span>
                </span>
                {item.badge && item.badge > 0 ? (
                  <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: Settings + Divider + User */}
        <div className="border-t border-gray-100 px-3 py-3 space-y-0.5">
          {/* Settings */}
          <Link
            href="/settings"
            onClick={() => setSidebarOpen(false)}
            className={navItemClass(settingsActive)}
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className={cn(
                'transition-colors duration-150',
                settingsActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
              )}>
                <IconSettings />
              </span>
              <span className="truncate">{t('settings')}</span>
            </span>
          </Link>
        </div>

        {/* User strip */}
        <div className="px-3 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
            <Avatar name={user?.full_name} src={user?.avatar_url} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {user?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              title={t('signOut')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
              <IconSignOut />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      {/*
          ps-64 = padding-inline-start: 16rem
          Flips to padding-inline-end in RTL automatically,
          offsetting content away from the sidebar on the correct side.
      */}
      <div className="lg:ps-64 min-h-screen flex flex-col">

        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shrink-0">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-14">

            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors lg:hidden"
              aria-label="Open menu"
            >
              <IconMenu />
            </button>

            {/* Page title breadcrumb — auto-detected from path */}
            <div className="hidden sm:block flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 capitalize truncate">
                {pathname.split('/').filter(Boolean)[0]?.replace('-', ' ') || 'dashboard'}
              </p>
            </div>

            <div className="flex-1 lg:hidden" />

            {/* Language switcher */}
            <div className="relative shrink-0 ms-auto">
              <button
                onClick={() => setLangMenuOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-all duration-150',
                  langMenuOpen
                    ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                )}
                aria-label="Change language"
                aria-expanded={langMenuOpen}
              >
                <IconGlobe />
                <span className="text-base leading-none">{localeFlags[locale]}</span>
                <span className="hidden sm:inline">{localeNames[locale]}</span>
                <span className={cn(
                  'transition-transform duration-200',
                  langMenuOpen ? 'rotate-180' : 'rotate-0'
                )}>
                  <IconChevronDown />
                </span>
              </button>

              {langMenuOpen && (
                <>
                  {/* Click-outside trap */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLangMenuOpen(false)}
                  />

                  {/* Dropdown panel */}
                  <div className={cn(
                    'absolute end-0 top-full mt-2 z-20',
                    'w-52 bg-white rounded-2xl border border-gray-200',
                    'shadow-xl shadow-gray-200/60',
                    'py-1.5 overflow-hidden',
                    'animate-in fade-in slide-in-from-top-2 duration-150'
                  )}>
                    {/* Label */}
                    <p className="px-4 pt-1 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      Language
                    </p>

                    <div className="max-h-72 overflow-y-auto">
                      {locales.map((l) => {
                        const active = l === locale;
                        return (
                          <button
                            key={l}
                            onClick={() => {
                              setLocale(l as Locale);
                              setLangMenuOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-start',
                              active
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            <span className="text-base leading-none w-6 shrink-0 text-center">
                              {localeFlags[l as Locale]}
                            </span>
                            <span className="flex-1 truncate">
                              {localeNames[l as Locale]}
                            </span>
                            {active && <IconCheck />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
