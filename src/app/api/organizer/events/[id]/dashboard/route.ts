import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import { getEventDashboard } from '@/lib/events/operations';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Returns R12 event dashboard metrics for an event owned by the authenticated organizer (R13).
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    const dashboard = await getEventDashboard(organizer.id, id);
    if (!dashboard) {
      return NextResponse.json(
        { error: 'not_found', message: 'Evento não encontrado.' },
        { status: 404 },
      );
    }

    return NextResponse.json(dashboard, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_event_dashboard_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao carregar painel do evento.' },
      { status: 500 },
    );
  }
}
