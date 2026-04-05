import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Medical Study Planner',
  description: 'AI-powered medical exam study planner',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
