/**
 * Root Layout
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { LocaleProvider } from '@/providers/locale-provider';
import enMessages from '../../messages/en.json';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'AI Client Dashboard',
  description: 'AI-powered client dashboard for project management and task execution',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className={inter.className}>
        <LocaleProvider initialMessages={enMessages} initialLocale="en">
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
