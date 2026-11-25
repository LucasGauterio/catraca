import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  formatEventDateTime,
  formatPriceBrl,
  getTicketStatusLabel,
} from '@/components/storefront/formatters';
import { db } from '@/db';
import { events, tickets, type TicketStatus } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getStatusBadgeClasses(status: TicketStatus): string {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'pending':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'declined':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'cancelled':
      return 'border-slate-300 bg-slate-100 text-slate-700';
    case 'refunded':
      return 'border-purple-200 bg-purple-50 text-purple-800';
  }
}

/**
 * Authenticated participant "Meus ingressos" page showing all purchased tickets with
 * event name, exact Portuguese status label, and unique ticket code (R09).
 */
export default async function MyTicketsPage(): Promise<React.ReactElement> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const rows = await db
    .select({
      ticketId: tickets.id,
      code: tickets.code,
      status: tickets.status,
      checkedIn: tickets.checkedIn,
      priceCents: tickets.priceCents,
      createdAt: tickets.createdAt,
      eventId: events.id,
      eventName: events.name,
      eventStartsAt: events.startsAt,
      eventLocation: events.location,
    })
    .from(tickets)
    .innerJoin(events, eq(tickets.eventId, events.id))
    .where(eq(tickets.userId, user.id))
    .orderBy(desc(tickets.createdAt));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meus ingressos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe o status e o código único de cada ingresso comprado. Recarregue a página para
            atualizar pedidos pendentes.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Voltar para a vitrine
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-slate-600">Você ainda não comprou nenhum ingresso.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Explorar eventos disponíveis
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((ticket) => {
            const statusLabel = getTicketStatusLabel(ticket.status);
            return (
              <article
                key={ticket.ticketId}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center"
                data-testid={`ticket-row-${ticket.ticketId}`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900">{ticket.eventName}</h2>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClasses(ticket.status)}`}
                    >
                      {statusLabel}
                    </span>
                    {ticket.checkedIn && (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        Check-in realizado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {formatEventDateTime(ticket.eventStartsAt)} • {ticket.eventLocation}
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    Valor pago: {formatPriceBrl(ticket.priceCents)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left sm:text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Código do ingresso
                  </p>
                  <p className="mt-0.5 font-mono text-xl font-bold tracking-widest text-slate-900">
                    {ticket.code}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
