import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/RegisterForm';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Participant registration page.
 */
export default async function RegisterPage(): Promise<React.ReactElement> {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === 'organizer' ? '/organizer' : '/');
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Criar conta de participante</h1>
      <p className="mt-1 text-sm text-slate-600">
        Cadastre-se para comprar ingressos e acompanhar seus pedidos.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </div>
  );
}
