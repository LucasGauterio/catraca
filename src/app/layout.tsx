import type { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { getSessionUser } from '@/lib/auth';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Catraca — Venda de Ingressos',
  description: 'Plataforma de venda e controle de ingressos para eventos.',
};

/**
 * Root application layout rendering the session-aware global Navbar and main content container.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const user = await getSessionUser();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Navbar user={user} />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
