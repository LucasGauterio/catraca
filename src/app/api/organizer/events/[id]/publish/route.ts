import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import { EventServiceError, publishOrganizerEvent } from '@/lib/events/service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Publishes an organizer's draft event (`draft -> published`, R02), rejecting non-owners (R13)
 * and cancelled events (R11).
 */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    const event = await publishOrganizerEvent(organizer.id, id);
    return NextResponse.json({ event }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    if (error instanceof EventServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_publish_event_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao publicar evento.' },
      { status: 500 },
    );
  }
}
