import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { tickets, type EventStatus, type TicketStatus } from '../../db/schema';

export interface PublishedEventWithSeats {
  id: string;
  organizerId: string;
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  availableSeats: number;
}

export interface TicketStatusLookup {
  ticketId: string;
  code: string;
  eventId: string;
  status: TicketStatus;
  checkedIn: boolean;
}

interface EventAvailabilityRow {
  [key: string]: unknown;
  status: EventStatus;
  capacity: number;
  occupied: number;
}

interface PublishedEventRow {
  [key: string]: unknown;
  id: string;
  organizer_id: string;
  name: string;
  starts_at: Date | string;
  location: string;
  capacity: number;
  price_cents: number;
  status: EventStatus;
  available_seats: number;
}

/**
 * Computes the number of currently available seats for an event (R05).
 * Returns `0` when the event does not exist or has status `'cancelled'`,
 * otherwise returns `Math.max(0, capacity - occupied)` where `occupied`
 * counts tickets with status `'pending'` or `'confirmed'`.
 */
export async function getEventAvailableSeats(eventId: string): Promise<number> {
  const result = await db.execute<EventAvailabilityRow>(sql`
    SELECT
      e.status,
      e.capacity,
      COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'confirmed'))::int AS occupied
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id
    WHERE e.id = ${eventId}
    GROUP BY e.id
  `);

  const row = result.rows[0];
  if (!row || row.status === 'cancelled') {
    return 0;
  }

  return Math.max(0, Number(row.capacity) - Number(row.occupied));
}

/**
 * Lists all events with status `'published'` ordered by `starts_at ASC`,
 * including their computed `availableSeats` in a single SQL query (R05).
 */
export async function listPublishedEventsWithSeats(): Promise<PublishedEventWithSeats[]> {
  const result = await db.execute<PublishedEventRow>(sql`
    SELECT
      e.id,
      e.organizer_id,
      e.name,
      e.starts_at,
      e.location,
      e.capacity,
      e.price_cents,
      e.status,
      GREATEST(
        0,
        e.capacity - COUNT(t.id) FILTER (WHERE t.status IN ('pending', 'confirmed'))::int
      )::int AS available_seats
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id
    WHERE e.status = 'published'
    GROUP BY e.id
    ORDER BY e.starts_at ASC, e.id ASC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    startsAt: row.starts_at instanceof Date ? row.starts_at : new Date(row.starts_at),
    location: row.location,
    capacity: Number(row.capacity),
    priceCents: Number(row.price_cents),
    status: row.status,
    availableSeats: Number(row.available_seats),
  }));
}

/**
 * Retrieves a ticket summary by its ID across any purchase channel (R09).
 * Returns `null` if no ticket matches the provided `ticketId`.
 */
export async function getTicketById(ticketId: string): Promise<TicketStatusLookup | null> {
  const rows = await db
    .select({
      ticketId: tickets.id,
      code: tickets.code,
      eventId: tickets.eventId,
      status: tickets.status,
      checkedIn: tickets.checkedIn,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);

  return rows[0] ?? null;
}
