import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getTicketStatusLabel } from '@/components/storefront/formatters';
import { db } from '@/db';
import { events, tickets } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Returns all tickets purchased by the currently authenticated user,
 * including event details and PT-BR status labels (R09).
 */
export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Autenticação obrigatória' },
      { status: 401 },
    );
  }

  try {
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

    return NextResponse.json(
      {
        tickets: rows.map((row) => ({
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
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('my_tickets_query_failed', {
      userId: user.id,
      error,
    });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao carregar seus ingressos' },
      { status: 500 },
    );
  }
}
