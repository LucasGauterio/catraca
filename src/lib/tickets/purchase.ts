import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { tickets, type EventStatus, type TicketChannel } from '../../db/schema';
import { isValidCardNumber } from '../gateway/simulator';
import { logger } from '../logger';
import { getPaymentGatewayQueue, type PaymentJobPayload } from '../queue';

const TICKET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TICKET_CODE_LENGTH = 8;
const MAX_CODE_INSERT_ATTEMPTS = 5;
const BUYER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PurchaseErrorCode = 'invalid_request' | 'event_not_available' | 'sold_out';

/**
 * Domain error representing a rejected ticket purchase attempt.
 */
export class PurchaseError extends Error {
  readonly code: PurchaseErrorCode;

  constructor(code: PurchaseErrorCode, message: string) {
    super(message);
    this.name = 'PurchaseError';
    this.code = code;
  }
}

export interface PurchaseTicketInput {
  eventId: string;
  buyerEmail: string;
  cardNumber: string;
  channel: TicketChannel;
  userId?: string | null;
}

export interface PurchasedTicketSummary {
  ticketId: string;
  code: string;
  status: 'pending';
}

export type PurchaseTicketResult =
  | {
      ok: true;
      ticket: PurchasedTicketSummary;
    }
  | {
      ok: false;
      error: PurchaseErrorCode;
      message: string;
    };

export interface PurchaseTicketOptions {
  /**
   * Optional override for enqueuing the payment job (useful in isolated tests).
   * Defaults to enqueuing on the BullMQ `payment-gateway` queue with `jobId = ticketId`.
   */
  enqueuePayment?: (payload: PaymentJobPayload) => Promise<void>;
}

interface LockedEventRow {
  [key: string]: unknown;
  id: string;
  status: EventStatus;
  capacity: number;
  price_cents: number;
}

interface OccupiedCountRow {
  [key: string]: unknown;
  occupied: number;
}

function isUniqueViolationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const pgError = error as { code?: unknown; cause?: { code?: unknown } };
  return pgError.code === '23505' || pgError.cause?.code === '23505';
}

async function defaultEnqueuePayment(payload: PaymentJobPayload): Promise<void> {
  const queue = getPaymentGatewayQueue();
  await queue.add('process-payment', payload, {
    jobId: payload.ticketId,
  });
}

/**
 * Validates whether a buyer email has a valid format and acceptable length.
 */
export function isValidBuyerEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {
    return false;
  }
  return BUYER_EMAIL_REGEX.test(trimmed);
}

/**
 * Generates an 8-character uppercase alphanumeric ticket code using an unambiguous
 * 32-character alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) without modulo bias.
 */
export function generateTicketCode(): string {
  const bytes = randomBytes(TICKET_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    code += TICKET_CODE_ALPHABET[bytes[i] & 31];
  }
  return code;
}

/**
 * Reserves a ticket atomically using a PostgreSQL row-level lock (`SELECT ... FOR UPDATE`)
 * on the target event to guarantee zero overselling under high concurrency (R07).
 *
 * Validates `buyerEmail` and `cardNumber` (`/^\d{16}$/`) before opening a database transaction.
 * After commit, enqueues a simulated payment job on BullMQ (`payment-gateway`) and returns
 * immediately with `status: 'pending'` (R06).
 */
export async function purchaseTicket(
  input: PurchaseTicketInput,
  options?: PurchaseTicketOptions,
): Promise<PurchaseTicketResult> {
  if (
    typeof input.eventId !== 'string' ||
    input.eventId.trim().length === 0 ||
    typeof input.buyerEmail !== 'string' ||
    !isValidBuyerEmail(input.buyerEmail) ||
    typeof input.cardNumber !== 'string' ||
    !isValidCardNumber(input.cardNumber) ||
    (input.channel !== 'web' && input.channel !== 'partner')
  ) {
    return {
      ok: false,
      error: 'invalid_request',
      message: 'Invalid purchase request: check eventId, buyerEmail, cardNumber, and channel.',
    };
  }

  const normalizedEventId = input.eventId.trim();
  const normalizedEmail = input.buyerEmail.trim().toLowerCase();
  const cardLast4 = input.cardNumber.slice(-4);

  const txResult = await db.transaction(async (tx): Promise<PurchaseTicketResult> => {
    const lockedEvents = await tx.execute<LockedEventRow>(sql`
      SELECT id, status, capacity, price_cents
      FROM events
      WHERE id = ${normalizedEventId}
      FOR UPDATE
    `);

    const eventRow = lockedEvents.rows[0];
    if (!eventRow || eventRow.status !== 'published') {
      return {
        ok: false,
        error: 'event_not_available',
        message: 'Event is not available for purchase.',
      };
    }

    const occupiedResult = await tx.execute<OccupiedCountRow>(sql`
      SELECT COUNT(*)::int AS occupied
      FROM tickets
      WHERE event_id = ${normalizedEventId}
        AND status IN ('pending', 'confirmed')
    `);

    const occupied = Number(occupiedResult.rows[0]?.occupied ?? 0);
    const capacity = Number(eventRow.capacity);

    if (occupied >= capacity) {
      return {
        ok: false,
        error: 'sold_out',
        message: 'Event has no available seats.',
      };
    }

    const priceCents = Number(eventRow.price_cents);

    for (let attempt = 1; attempt <= MAX_CODE_INSERT_ATTEMPTS; attempt += 1) {
      const ticketId = `tkt_${randomBytes(6).toString('hex')}`;
      const code = generateTicketCode();

      await tx.execute(sql`SAVEPOINT insert_ticket_attempt`);
      try {
        await tx.insert(tickets).values({
          id: ticketId,
          code,
          eventId: normalizedEventId,
          userId: input.userId ?? null,
          buyerEmail: normalizedEmail,
          channel: input.channel,
          priceCents,
          status: 'pending',
          checkedIn: false,
        });
        await tx.execute(sql`RELEASE SAVEPOINT insert_ticket_attempt`);

        return {
          ok: true,
          ticket: {
            ticketId,
            code,
            status: 'pending',
          },
        };
      } catch (error) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT insert_ticket_attempt`);
        if (isUniqueViolationError(error) && attempt < MAX_CODE_INSERT_ATTEMPTS) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate a unique ticket code after maximum retries.');
  });

  if (!txResult.ok) {
    return txResult;
  }

  const payload: PaymentJobPayload = {
    ticketId: txResult.ticket.ticketId,
    cardLast4,
  };

  const enqueue = options?.enqueuePayment ?? defaultEnqueuePayment;
  await enqueue(payload);

  logger.info('ticket_purchase_reserved', {
    ticketId: txResult.ticket.ticketId,
    eventId: normalizedEventId,
    channel: input.channel,
    cardLast4,
    status: txResult.ticket.status,
  });

  return txResult;
}
