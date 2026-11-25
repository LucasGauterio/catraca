import { NextResponse } from 'next/server';
import { getPool } from '@/db';
import { logger } from '@/lib/logger';
import { checkRedisHealth } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint verifying PostgreSQL (`SELECT 1`) and Redis (`PING`) connectivity.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await getPool().query('SELECT 1');
    const redisOk = await checkRedisHealth();

    if (!redisOk) {
      return NextResponse.json(
        { status: 'error', db: 'connected', redis: 'disconnected' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { status: 'ok', db: 'connected', redis: 'connected' },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error('health_check_failed', { error });
    return NextResponse.json(
      { status: 'error', db: 'disconnected', redis: 'unknown' },
      { status: 503 },
    );
  }
}
