import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TopNav } from './components/TopNav';
import './globals.css';

export const metadata: Metadata = { title: 'Internal Tools' };

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <TopNav />
        <main className="mx-auto max-w-5xl space-y-6 p-6">{children}</main>
      </body>
    </html>
  );
}
