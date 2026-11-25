import { NextResponse } from 'next/server';
import { AuthError, requireOrganizer } from '@/lib/auth';
import { createEvent, EventServiceError, listOrganizerEvents } from '@/lib/events/service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Lists all events owned exclusively by the authenticated organizer (R13).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();
    const events = await listOrganizerEvents(organizer.id);
    return NextResponse.json({ events }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('organizer_list_events_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao listar eventos.' },
      { status: 500 },
    );
  }
}

/**
 * Creates a new event in `'draft'` status for the authenticated organizer (R01, R02).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const organizer = await requireOrganizer();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Corpo JSON inválido.' },
        { status: 400 },
      );
    }

    const event = await createEvent(organizer.id, body);
    return NextResponse.json({ event }, { status: 201 });
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
    logger.error('organizer_create_event_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao criar evento.' },
      { status: 500 },
    );
  }
}
