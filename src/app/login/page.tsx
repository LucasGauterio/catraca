import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Login page for organizers and participants.
 */
export default async function LoginPage(): Promise<React.ReactElement> {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === 'organizer' ? '/organizer' : '/');
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Entrar na Catraca</h1>
      <p className="mt-1 text-sm text-slate-600">
        Acesse sua conta de participante ou organizador.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
