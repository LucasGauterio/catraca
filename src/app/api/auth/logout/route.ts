import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Terminates the current user session and clears the `catraca_session` cookie.
 */
export async function POST(): Promise<NextResponse> {
  try {
    await destroySession();
    logger.info('auth_logout_succeeded');
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('auth_logout_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao encerrar sessão.' },
      { status: 500 },
    );
  }
}
