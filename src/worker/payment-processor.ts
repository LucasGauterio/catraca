import { sql } from 'drizzle-orm';
import { db } from '../db';
import type { TicketStatus } from '../db/schema';
import {
  evaluateSimulatedCard,
  type SimulatedPaymentOutcome,
} from '../lib/gateway/simulator';
import { logger } from '../lib/logger';
import type { PaymentJobPayload } from '../lib/queue';

export interface ProcessPaymentJobOptions {
  /**
   * Optional delay scale override (e.g. `0` in tests to skip waiting).
   */
  delayScale?: number;
}

export interface ProcessPaymentJobResult {
  ticketId: string;
  outcome: SimulatedPaymentOutcome;
  delayMs: number;
  updated: boolean;
  finalStatus: TicketStatus | null;
}

interface UpdatedTicketRow {
  [key: string]: unknown;
  id: string;
  status: TicketStatus;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Processes an asynchronous simulated payment job for a reserved ticket (R08).
 *
 * Evaluates the simulated gateway outcome and latency from `cardLast4`, awaits the
 * simulated delay, and executes an atomic conditional SQL update that ONLY transitions
 * tickets still in `'pending'` belonging to a `'published'` event — protecting cancelled
 * or refunded tickets from late gateway responses (R11).
 */
export async function processPaymentJob(
  jobData: PaymentJobPayload,
  options?: ProcessPaymentJobOptions,
): Promise<ProcessPaymentJobResult> {
  const { outcome, delayMs } = evaluateSimulatedCard(
    `400000000000${jobData.cardLast4}`,
    options?.delayScale,
  );

  logger.info('payment_job_processing_started', {
    ticketId: jobData.ticketId,
    cardLast4: jobData.cardLast4,
    outcome,
    delayMs,
  });

  await sleep(delayMs);

  const updateResult = await db.execute<UpdatedTicketRow>(sql`
    UPDATE tickets t
    SET status = ${outcome}, updated_at = NOW()
    FROM events e
    WHERE t.id = ${jobData.ticketId}
      AND t.event_id = e.id
      AND t.status = 'pending'
      AND e.status = 'published'
    RETURNING t.id, t.status
  `);

  const updatedRow = updateResult.rows[0] ?? null;

  if (updatedRow) {
    logger.info('payment_job_applied', {
      ticketId: jobData.ticketId,
      cardLast4: jobData.cardLast4,
      outcome,
      delayMs,
      finalStatus: updatedRow.status,
    });
  } else {
    logger.info('payment_job_ignored_by_guard', {
      ticketId: jobData.ticketId,
      cardLast4: jobData.cardLast4,
      outcome,
      delayMs,
      reason: 'ticket_not_pending_or_event_not_published',
    });
  }

  return {
    ticketId: jobData.ticketId,
    outcome,
    delayMs,
    updated: updatedRow !== null,
    finalStatus: updatedRow ? updatedRow.status : null,
  };
}
