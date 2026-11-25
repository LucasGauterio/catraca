import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import {
  EventServiceError,
  getOrganizerEventById,
  updateOrganizerEvent,
} from '@/lib/events/service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Returns a single event owned by the authenticated organizer, or 404 without leaking data (R13).
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    const event = await getOrganizerEventById(organizer.id, id);
    if (!event) {
      return NextResponse.json(
        { error: 'not_found', message: 'Evento não encontrado.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_get_event_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao carregar evento.' },
      { status: 500 },
    );
  }
}

/**
 * Updates an organizer's event while enforcing R01, R03, R05, R11, and R13.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Corpo JSON inválido.' },
        { status: 400 },
      );
    }

    const event = await updateOrganizerEvent(organizer.id, id, body);
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
    logger.error('organizer_update_event_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao atualizar evento.' },
      { status: 500 },
    );
  }
}
