/**
 * Root Layout
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>{children}</body>
    </html>
  );
}
