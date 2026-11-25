import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTicketStatusLabel } from '@/components/storefront/formatters';
import { db } from '@/db';
import { events, tickets } from '@/db/schema';
import { AuthError, requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Lists all tickets purchased by the currently authenticated user, ordered by newest first (R09).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await requireUser();

    const rows = await db
      .select({
        ticketId: tickets.id,
        code: tickets.code,
        status: tickets.status,
        checkedIn: tickets.checkedIn,
        priceCents: tickets.priceCents,
        createdAt: tickets.createdAt,
        eventId: events.id,
        eventName: events.name,
        eventStartsAt: events.startsAt,
        eventLocation: events.location,
        eventStatus: events.status,
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.eventId, events.id))
      .where(eq(tickets.userId, user.id))
      .orderBy(desc(tickets.createdAt));

    const payload = rows.map((row) => ({
      ticketId: row.ticketId,
      code: row.code,
      status: row.status,
      statusLabel: getTicketStatusLabel(row.status),
      checkedIn: row.checkedIn,
      priceCents: row.priceCents,
      createdAt: row.createdAt.toISOString(),
      event: {
        id: row.eventId,
        name: row.eventName,
        startsAt: row.eventStartsAt.toISOString(),
        location: row.eventLocation,
        status: row.eventStatus,
      },
    }));

    return NextResponse.json({ tickets: payload }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('participant_my_tickets_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao consultar seus ingressos.' },
      { status: 500 },
    );
  }
}
