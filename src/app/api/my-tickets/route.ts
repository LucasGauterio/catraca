import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listUserTickets } from '@/lib/tickets/my-tickets';

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
    const userTickets = await listUserTickets(user.id);
    return NextResponse.json(
      {
        tickets: userTickets.map((ticket) => ({
          ticketId: ticket.ticketId,
          code: ticket.code,
          eventId: ticket.eventId,
          eventName: ticket.eventName,
          eventStartsAt: ticket.eventStartsAt.toISOString(),
          eventLocation: ticket.eventLocation,
          status: ticket.status,
          statusLabel: ticket.statusLabel,
          checkedIn: ticket.checkedIn,
          priceCents: ticket.priceCents,
          createdAt: ticket.createdAt.toISOString(),
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
