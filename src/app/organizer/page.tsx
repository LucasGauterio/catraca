import { redirect } from 'next/navigation';
import { AuthError, requireOrganizer, type AuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Organizer dashboard shell strictly protected by `requireOrganizer()` (R13).
 */
export default async function OrganizerPage(): Promise<React.ReactElement> {
  let organizer: AuthenticatedUser;
  try {
    organizer = await requireOrganizer();
  } catch (error: unknown) {
    if (error instanceof AuthError && error.statusCode === 403) {
      redirect('/');
    }
    redirect('/login');
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Área do Organizador</h1>
            <p className="mt-1 text-sm text-slate-600">
              Bem-vindo, <span className="font-semibold text-slate-900">{organizer.name}</span>.
              Gerencie seus eventos, ingressos e check-ins neste painel.
            </p>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase text-white">
            Acesso Organizador
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Seus eventos aparecerão aqui assim que o módulo de gestão de eventos for habilitado.
      </div>
    </section>
  );
}
