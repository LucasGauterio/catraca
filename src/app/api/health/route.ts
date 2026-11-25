import { NextResponse } from 'next/server';
import { getPool } from '@/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint verifying application readiness and PostgreSQL connectivity.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getPool().query('SELECT 1');
    return NextResponse.json({ status: 'ok', db: 'connected' }, { status: 200 });
  } catch (error: unknown) {
    logger.error('health_check_failed', { error });
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 });
  }
}
