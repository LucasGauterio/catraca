import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import { cancelEvent } from '@/lib/events/operations';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Irreversibly cancels an organizer's published event (R11, R13).
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    const result = await cancelEvent(organizer.id, id);
    if (!result.ok) {
      if (result.error === 'not_found') {
        return NextResponse.json(
          { error: 'not_found', message: 'Evento não encontrado.' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        {
          error: 'not_cancellable',
          message: 'Apenas eventos publicados podem ser cancelados.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        status: result.status,
        refundedCount: result.refundedCount,
        cancelledCount: result.cancelledCount,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_event_cancel_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao cancelar evento.' },
      { status: 500 },
    );
  }
}
