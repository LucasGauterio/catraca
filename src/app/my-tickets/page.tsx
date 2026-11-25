import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { TicketStatus } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { formatBrlFromCents, formatEventDateTimePtBr } from '@/lib/tickets/labels';
import { listUserTickets } from '@/lib/tickets/my-tickets';

export const dynamic = 'force-dynamic';

const STATUS_BADGE_CLASSES: Readonly<Record<TicketStatus, string>> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  declined: 'border-red-200 bg-red-50 text-red-800',
  cancelled: 'border-slate-300 bg-slate-100 text-slate-700',
  refunded: 'border-purple-200 bg-purple-50 text-purple-800',
};

/**
 * Participant "Meus ingressos" page displaying each purchased ticket with
 * event name, PT-BR status label, and unique ticket code (R09).
 */
export default async function MyTicketsPage(): Promise<React.ReactElement> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const userTickets = await listUserTickets(user.id);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Meus ingressos
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe o status e o código único de cada ingresso comprado na vitrine.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Voltar para Vitrine
        </Link>
      </div>

      {userTickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">Você ainda não possui ingressos comprados.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Explorar eventos publicados
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Evento
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Data e Local
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Valor
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Código
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {userTickets.map((ticket) => (
                  <tr key={ticket.ticketId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {ticket.eventName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{formatEventDateTimePtBr(ticket.eventStartsAt)}</div>
                      <div className="text-xs text-slate-500">{ticket.eventLocation}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {formatBrlFromCents(ticket.priceCents)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[ticket.status]}`}
                      >
                        {ticket.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm font-bold text-slate-900">
                      {ticket.code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
