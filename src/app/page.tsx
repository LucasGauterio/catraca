import Link from 'next/link';
import {
  StorefrontClient,
  type StorefrontEventItem,
} from '@/components/storefront/StorefrontClient';
import { getSessionUser } from '@/lib/auth';
import { formatBrlFromCents, formatEventDateTimePtBr } from '@/lib/tickets/labels';
import { listPublishedEventsWithSeats } from '@/lib/tickets/queries';

export const dynamic = 'force-dynamic';

/**
 * Public storefront page listing exclusively published events with live seat counts (R02, R07).
 */
export default async function HomePage(): Promise<React.ReactElement> {
  const [user, publishedEvents] = await Promise.all([
    getSessionUser(),
    listPublishedEventsWithSeats(),
  ]);

  const storefrontEvents: StorefrontEventItem[] = publishedEvents.map((event) => ({
    id: event.id,
    name: event.name,
    formattedStartsAt: formatEventDateTimePtBr(event.startsAt),
    location: event.location,
    priceCents: event.priceCents,
    formattedPrice: formatBrlFromCents(event.priceCents),
    capacity: event.capacity,
    availableSeats: event.availableSeats,
  }));

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

      <StorefrontClient events={storefrontEvents} isAuthenticated={Boolean(user)} />
    </section>
  );
}
