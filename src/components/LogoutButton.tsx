'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Interactive button that posts to `/api/auth/logout`, clears the session, and refreshes the page.
 */
export function LogoutButton(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout(): Promise<void> {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:opacity-50"
    >
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  );
}
