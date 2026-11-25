import Link from 'next/link';
import { EventManageClient } from '@/components/organizer/EventManageClient';
import { getSessionUser } from '@/lib/auth';
import { getEventDashboard } from '@/lib/events/operations';
import { getOrganizerEventById } from '@/lib/events/service';

export const dynamic = 'force-dynamic';

interface OrganizerEventPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Dedicated organizer event management page (R04).
 * Enforces strict server-side isolation (R13): if the visitor is unauthenticated,
 * not an organizer, or does not own the requested event, renders an access-denied / not-found
 * view with ZERO event data leaked.
 */
export default async function OrganizerEventPage({
  params,
}: OrganizerEventPageProps): Promise<React.ReactElement> {
  const user = await getSessionUser();

  if (!user || user.role !== 'organizer') {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Acesso negado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Você não tem permissão para acessar a gestão deste evento.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!user ? (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Entrar
            </Link>
          ) : (
            <Link
              href="/"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Voltar à vitrine
            </Link>
          )}
        </div>
      </section>
    );
  }

  const { id } = await params;
  const [event, dashboard] = await Promise.all([
    getOrganizerEventById(user.id, id),
    getEventDashboard(user.id, id),
  ]);

  if (!event || !dashboard) {
    return (
      <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Evento não encontrado</h1>
        <p className="mt-2 text-sm text-slate-600">
          O evento solicitado não existe ou você não tem permissão para gerenciá-lo.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/organizer"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Voltar para Meus Eventos
          </Link>
        </div>
      </section>
    );
  }

  return <EventManageClient initialEvent={event} initialDashboard={dashboard} />;
}
