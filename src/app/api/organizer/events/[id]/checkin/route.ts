import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import { performCheckIn } from '@/lib/events/operations';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Validates and executes ticket check-in for an organizer's event following R10 and R13.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Corpo da requisição inválido.' },
        { status: 422 },
      );
    }

    if (
      typeof rawBody !== 'object' ||
      rawBody === null ||
      Array.isArray(rawBody) ||
      typeof (rawBody as Record<string, unknown>).code !== 'string'
    ) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Informe o código do ingresso.' },
        { status: 422 },
      );
    }

    const code = (rawBody as { code: string }).code;
    const result = await performCheckIn(organizer.id, id, code);

    if (!result.found) {
      return NextResponse.json(
        { error: 'not_found', message: 'Evento não encontrado.' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: result.ok, message: result.message },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_event_checkin_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao realizar check-in.' },
      { status: 500 },
    );
  }
}
