import Link from 'next/link';
import type { AuthenticatedUser } from '@/lib/auth';
import { LogoutButton } from './LogoutButton';

export interface NavbarProps {
  user: AuthenticatedUser | null;
}

/**
 * Global navigation bar displaying contextual links for visitors, participants, and organizers.
 */
export function Navbar({ user }: NavbarProps): React.ReactElement {
  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            Catraca
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/" className="text-slate-200 transition hover:text-white">
              Vitrine
            </Link>
            {user?.role === 'participant' && (
              <Link href="/my-tickets" className="text-slate-200 transition hover:text-white">
                Meus ingressos
              </Link>
            )}
            {user?.role === 'organizer' && (
              <Link href="/organizer" className="text-slate-200 transition hover:text-white">
                Área do Organizador
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-300 sm:inline">
                {user.name}{' '}
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-200">
                  {user.role === 'organizer' ? 'Organizador' : 'Participante'}
                </span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
