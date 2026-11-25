import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { events, tickets, type TicketStatus } from '@/db/schema';
import { getTicketStatusLabel } from './labels';

export interface UserTicketItem {
  ticketId: string;
  code: string;
  eventId: string;
  eventName: string;
  eventStartsAt: Date;
  eventLocation: string;
  status: TicketStatus;
  statusLabel: string;
  checkedIn: boolean;
  priceCents: number;
  createdAt: Date;
}

/**
 * Queries all tickets purchased by a specific user joined with their parent events,
 * ordered by creation date descending, including PT-BR status labels (R09).
 */
export async function listUserTickets(userId: string): Promise<UserTicketItem[]> {
  const rows = await db
    .select({
      ticketId: tickets.id,
      code: tickets.code,
      eventId: tickets.eventId,
      eventName: events.name,
      eventStartsAt: events.startsAt,
      eventLocation: events.location,
      status: tickets.status,
      checkedIn: tickets.checkedIn,
      priceCents: tickets.priceCents,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .innerJoin(events, eq(tickets.eventId, events.id))
    .where(eq(tickets.userId, userId))
    .orderBy(desc(tickets.createdAt));

  return rows.map((row) => ({
    ticketId: row.ticketId,
    code: row.code,
    eventId: row.eventId,
    eventName: row.eventName,
    eventStartsAt: row.eventStartsAt,
    eventLocation: row.eventLocation,
    status: row.status,
    statusLabel: getTicketStatusLabel(row.status),
    checkedIn: row.checkedIn,
    priceCents: row.priceCents,
    createdAt: row.createdAt,
  }));
}
