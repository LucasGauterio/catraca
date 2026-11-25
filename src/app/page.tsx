import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Public storefront landing page shell (events catalog will be populated in F04).
 */
export default async function HomePage(): Promise<React.ReactElement> {
  const user = await getSessionUser();

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Vitrine Catraca
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Explore eventos publicados e garanta seu ingresso com segurança e confirmação em tempo real.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {!user && (
            <>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Criar conta de participante
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Entrar
              </Link>
            </>
          )}
          {user?.role === 'organizer' && (
            <Link
              href="/organizer"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ir para Área do Organizador
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Nenhum evento publicado disponível no momento.
      </div>
    </section>
  );
}
