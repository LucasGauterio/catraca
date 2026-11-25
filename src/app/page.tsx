import Link from 'next/link';
import { EventPurchaseCard } from '@/components/storefront/EventPurchaseCard';
import { getSessionUser } from '@/lib/auth';
import { listPublishedEventsWithSeats } from '@/lib/tickets/queries';

export const dynamic = 'force-dynamic';

/**
 * Public storefront page listing exclusively published, non-cancelled events with live seat
 * counts (R02, R05, R07, R11). Accessible to visitors and authenticated users.
 */
export default async function HomePage(): Promise<React.ReactElement> {
  const [user, publishedEvents] = await Promise.all([
    getSessionUser(),
    listPublishedEventsWithSeats(),
  ]);

  return (
    <section className="space-y-8">
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
          {user && (
            <Link
              href="/my-tickets"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Meus ingressos
            </Link>
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

      {publishedEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nenhum evento publicado disponível no momento.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publishedEvents.map((event) => (
            <EventPurchaseCard
              key={event.id}
              event={{
                id: event.id,
                name: event.name,
                startsAt: event.startsAt.toISOString(),
                location: event.location,
                priceCents: event.priceCents,
                capacity: event.capacity,
                availableSeats: event.availableSeats,
              }}
              isAuthenticated={Boolean(user)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
