import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { events, type EventStatus, type TicketStatus } from '@/db/schema';
import { logger } from '@/lib/logger';
import { formatBrlFromCents } from '@/lib/tickets/labels';

export type CheckInMessage =
  | 'Ingresso inválido para este evento'
  | 'Evento cancelado'
  | 'Ingresso não confirmado'
  | 'Ingresso já utilizado'
  | 'Entrada liberada';

export interface CheckInDecisionInput {
  ticketFoundForEvent: boolean;
  eventStatus: EventStatus;
  ticketStatus: TicketStatus | null;
  alreadyCheckedIn: boolean;
}

export interface CheckInDecision {
  ok: boolean;
  message: CheckInMessage;
}

export type PerformCheckInResult =
  | { found: false }
  | ({ found: true } & CheckInDecision);

export interface EventDashboardTicketRow {
  status: TicketStatus;
  priceCents: number;
  checkedIn: boolean;
}

export interface EventDashboardMetrics {
  confirmed: number;
  pending: number;
  checkedIn: number;
  availableSeats: number;
  revenueCents: number;
  revenueFormatted: string;
  refunded: number;
}

export type CancelEventResult =
  | {
      ok: true;
      status: 'cancelled';
      refundedCount: number;
      cancelledCount: number;
    }
  | {
      ok: false;
      error: 'not_found' | 'not_cancellable';
    };

interface LockedEventOperationRow {
  id: string;
  organizer_id: string;
  status: EventStatus;
}

interface LockedTicketOperationRow {
  id: string;
  event_id: string;
  status: TicketStatus;
  checked_in: boolean;
}

interface DashboardAggregateRow {
  confirmed: number | string;
  pending: number | string;
  checked_in: number | string;
  revenue_cents: number | string;
  refunded: number | string;
}

/**
 * Evaluates the exact R10 check-in decision precedence order:
 * 1. Ticket does not exist or belongs to another event -> `Ingresso inválido para este evento`
 * 2. Event is cancelled -> `Evento cancelado`
 * 3. Ticket status is not `confirmed` -> `Ingresso não confirmado`
 * 4. Ticket already checked in -> `Ingresso já utilizado`
 * 5. Otherwise -> `Entrada liberada`
 */
export function evaluateCheckInDecision(input: CheckInDecisionInput): CheckInDecision {
  if (!input.ticketFoundForEvent) {
    return { ok: false, message: 'Ingresso inválido para este evento' };
  }
  if (input.eventStatus === 'cancelled') {
    return { ok: false, message: 'Evento cancelado' };
  }
  if (input.ticketStatus !== 'confirmed') {
    return { ok: false, message: 'Ingresso não confirmado' };
  }
  if (input.alreadyCheckedIn) {
    return { ok: false, message: 'Ingresso já utilizado' };
  }
  return { ok: true, message: 'Entrada liberada' };
}

/**
 * Computes R12/R05/R03 event dashboard metrics from event metadata and ticket rows
 * across all sales channels (`web` and `partner`).
 */
export function computeEventDashboard(
  event: { status: EventStatus; capacity: number },
  ticketRows: readonly EventDashboardTicketRow[],
): EventDashboardMetrics {
  let confirmed = 0;
  let pending = 0;
  let checkedIn = 0;
  let revenueCents = 0;
  let refunded = 0;

  for (const ticket of ticketRows) {
    if (ticket.status === 'confirmed') {
      confirmed += 1;
      revenueCents += ticket.priceCents;
      if (ticket.checkedIn) {
        checkedIn += 1;
      }
    } else if (ticket.status === 'pending') {
      pending += 1;
    } else if (ticket.status === 'refunded') {
      refunded += 1;
    }
  }

  const availableSeats =
    event.status === 'cancelled' ? 0 : Math.max(0, event.capacity - (confirmed + pending));

  return {
    confirmed,
    pending,
    checkedIn,
    availableSeats,
    revenueCents,
    revenueFormatted: formatBrlFromCents(revenueCents),
    refunded,
  };
}

/**
 * Performs transactional check-in for an organizer's event following R10 precedence and R13 ownership.
 * Locks both event and ticket rows with `SELECT ... FOR UPDATE` to prevent double check-in races.
 */
export async function performCheckIn(
  organizerId: string,
  eventId: string,
  rawCode: string,
): Promise<PerformCheckInResult> {
  return db.transaction(async (tx) => {
    const lockedEventResult = await tx.execute(
      sql`SELECT id, organizer_id, status FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    const eventRow = lockedEventResult.rows[0] as unknown as LockedEventOperationRow | undefined;

    if (!eventRow || eventRow.organizer_id !== organizerId) {
      return { found: false };
    }

    const code = rawCode.trim().toUpperCase();
    let ticketRow: LockedTicketOperationRow | undefined;

    if (code.length > 0) {
      const lockedTicketResult = await tx.execute(
        sql`SELECT id, event_id, status, checked_in FROM tickets WHERE code = ${code} FOR UPDATE`,
      );
      ticketRow = lockedTicketResult.rows[0] as unknown as LockedTicketOperationRow | undefined;
    }

    const ticketFoundForEvent = Boolean(ticketRow && ticketRow.event_id === eventId);
    const decision = evaluateCheckInDecision({
      ticketFoundForEvent,
      eventStatus: eventRow.status,
      ticketStatus: ticketRow ? ticketRow.status : null,
      alreadyCheckedIn: Boolean(ticketRow?.checked_in),
    });

    if (decision.ok && ticketRow) {
      await tx.execute(
        sql`UPDATE tickets SET checked_in = true, checked_in_at = NOW(), updated_at = NOW() WHERE id = ${ticketRow.id}`,
      );
    }

    logger.info('event_checkin_evaluated', {
      eventId,
      organizerId,
      ticketId: ticketFoundForEvent && ticketRow ? ticketRow.id : null,
      ok: decision.ok,
      message: decision.message,
    });

    return {
      found: true,
      ok: decision.ok,
      message: decision.message,
    };
  });
}

/**
 * Aggregates R12 management dashboard metrics over all tickets (`web` and `partner` channels)
 * for an event owned by `organizerId` (R13). Returns `null` if not found or not owned.
 */
export async function getEventDashboard(
  organizerId: string,
  eventId: string,
): Promise<EventDashboardMetrics | null> {
  const eventRows = await db
    .select({
      id: events.id,
      organizerId: events.organizerId,
      status: events.status,
      capacity: events.capacity,
    })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1);

  const eventRow = eventRows[0];
  if (!eventRow) {
    return null;
  }

  const aggResult = await db.execute(
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'confirmed' AND checked_in = true)::int AS checked_in,
        COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)::bigint AS revenue_cents,
        COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded
      FROM tickets
      WHERE event_id = ${eventId}
    `,
  );

  const row = aggResult.rows[0] as unknown as DashboardAggregateRow | undefined;
  const confirmed = Number(row?.confirmed ?? 0);
  const pending = Number(row?.pending ?? 0);
  const checkedIn = Number(row?.checked_in ?? 0);
  const revenueCents = Number(row?.revenue_cents ?? 0);
  const refunded = Number(row?.refunded ?? 0);
  const availableSeats =
    eventRow.status === 'cancelled'
      ? 0
      : Math.max(0, eventRow.capacity - (confirmed + pending));

  return {
    confirmed,
    pending,
    checkedIn,
    availableSeats,
    revenueCents,
    revenueFormatted: formatBrlFromCents(revenueCents),
    refunded,
  };
}

/**
 * Irreversibly cancels a published event owned by `organizerId` (R11, R13).
 * Atomically sets event status to `'cancelled'`, transitions all `'confirmed'` tickets
 * to `'refunded'`, and transitions all `'pending'` tickets to `'cancelled'`.
 */
export async function cancelEvent(
  organizerId: string,
  eventId: string,
): Promise<CancelEventResult> {
  return db.transaction(async (tx) => {
    const lockedEventResult = await tx.execute(
      sql`SELECT id, organizer_id, status FROM events WHERE id = ${eventId} FOR UPDATE`,
    );
    const eventRow = lockedEventResult.rows[0] as unknown as LockedEventOperationRow | undefined;

    if (!eventRow || eventRow.organizer_id !== organizerId) {
      return { ok: false, error: 'not_found' };
    }

    if (eventRow.status !== 'published') {
      return { ok: false, error: 'not_cancellable' };
    }

    await tx.execute(
      sql`UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = ${eventId}`,
    );

    const refundedResult = await tx.execute(
      sql`UPDATE tickets SET status = 'refunded', updated_at = NOW() WHERE event_id = ${eventId} AND status = 'confirmed' RETURNING id`,
    );

    const cancelledResult = await tx.execute(
      sql`UPDATE tickets SET status = 'cancelled', updated_at = NOW() WHERE event_id = ${eventId} AND status = 'pending' RETURNING id`,
    );

    const refundedCount = refundedResult.rows.length;
    const cancelledCount = cancelledResult.rows.length;

    logger.info('event_cancelled', {
      eventId,
      organizerId,
      status: 'cancelled',
      refundedCount,
      cancelledCount,
    });

    return {
      ok: true,
      status: 'cancelled',
      refundedCount,
      cancelledCount,
    };
  });
}
