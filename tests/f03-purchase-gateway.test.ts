import { randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../src/db';
import { events, tickets, users } from '../src/db/schema';
import {
  evaluateSimulatedCard,
  isValidCardNumber,
} from '../src/lib/gateway/simulator';
import type { PaymentJobPayload } from '../src/lib/queue';
import {
  generateTicketCode,
  isValidBuyerEmail,
  purchaseTicket,
} from '../src/lib/tickets/purchase';
import {
  getEventAvailableSeats,
  getTicketById,
  listPublishedEventsWithSeats,
} from '../src/lib/tickets/queries';
import { processPaymentJob } from '../src/worker/payment-processor';

const TEST_DB_URL =
  process.env.DATABASE_URL ?? 'postgres://catraca:catraca@127.0.0.1:54329/catraca';

async function isPostgresReachable(): Promise<boolean> {
  const probe = new Pool({
    connectionString: TEST_DB_URL,
    connectionTimeoutMillis: 1500,
    max: 1,
  });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

describe('F03 — Simulated Payment Gateway Rules', () => {
  it('validates 16-digit card numbers strictly', () => {
    expect(isValidCardNumber('4000000000000001')).toBe(true);
    expect(isValidCardNumber('0000000000000000')).toBe(true);
    expect(isValidCardNumber('123')).toBe(false);
    expect(isValidCardNumber('abcdabcdabcdabcd')).toBe(false);
    expect(isValidCardNumber('')).toBe(false);
    expect(isValidCardNumber('400000000000001')).toBe(false);
    expect(isValidCardNumber('40000000000000001')).toBe(false);
    expect(isValidCardNumber('4000 0000 0000 0001')).toBe(false);
  });

  it('throws on evaluateSimulatedCard with invalid card numbers', () => {
    expect(() => evaluateSimulatedCard('123')).toThrow();
    expect(() => evaluateSimulatedCard('abcdefghijklmnop')).toThrow();
    expect(() => evaluateSimulatedCard('')).toThrow();
  });

  it('evaluates all 5 card rules with exact delay bounds at scale 1', () => {
    const cases: Array<{
      card: string;
      expectedOutcome: 'confirmed' | 'declined';
      minMs: number;
      maxMs: number;
    }> = [
      { card: '4000000000000001', expectedOutcome: 'confirmed', minMs: 2000, maxMs: 5000 },
      { card: '4000000000000002', expectedOutcome: 'declined', minMs: 2000, maxMs: 5000 },
      { card: '4000000000000003', expectedOutcome: 'confirmed', minMs: 30000, maxMs: 40000 },
      { card: '4000000000000004', expectedOutcome: 'declined', minMs: 30000, maxMs: 40000 },
      { card: '4000000000009999', expectedOutcome: 'declined', minMs: 2000, maxMs: 5000 },
      { card: '5111222233334444', expectedOutcome: 'declined', minMs: 2000, maxMs: 5000 },
    ];

    for (const testCase of cases) {
      for (let i = 0; i < 25; i += 1) {
        const result = evaluateSimulatedCard(testCase.card, 1);
        expect(result.outcome).toBe(testCase.expectedOutcome);
        expect(Number.isInteger(result.delayMs)).toBe(true);
        expect(result.delayMs).toBeGreaterThanOrEqual(testCase.minMs);
        expect(result.delayMs).toBeLessThanOrEqual(testCase.maxMs);
      }
    }
  });

  it('supports delayScale parameter and GATEWAY_DELAY_SCALE env var', () => {
    const scaled = evaluateSimulatedCard('4000000000000003', 0.01);
    expect(scaled.outcome).toBe('confirmed');
    expect(scaled.delayMs).toBeGreaterThanOrEqual(300);
    expect(scaled.delayMs).toBeLessThanOrEqual(400);

    const zeroScaled = evaluateSimulatedCard('4000000000000001', 0);
    expect(zeroScaled.outcome).toBe('confirmed');
    expect(zeroScaled.delayMs).toBe(0);

    const previousEnv = process.env.GATEWAY_DELAY_SCALE;
    try {
      process.env.GATEWAY_DELAY_SCALE = '0.001';
      const envScaled = evaluateSimulatedCard('4000000000000004');
      expect(envScaled.outcome).toBe('declined');
      expect(envScaled.delayMs).toBeGreaterThanOrEqual(30);
      expect(envScaled.delayMs).toBeLessThanOrEqual(40);
    } finally {
      if (previousEnv === undefined) {
        delete process.env.GATEWAY_DELAY_SCALE;
      } else {
        process.env.GATEWAY_DELAY_SCALE = previousEnv;
      }
    }
  });
});

describe('F03 — Ticket Code & Input Validation', () => {
  it('generates unique 8-character unambiguous uppercase alphanumeric codes', () => {
    const seen = new Set<string>();
    const pattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

    for (let i = 0; i < 500; i += 1) {
      const code = generateTicketCode();
      expect(code).toMatch(pattern);
      expect(code).not.toMatch(/[01IO]/);
      seen.add(code);
    }

    expect(seen.size).toBe(500);
  });

  it('validates buyer email format', () => {
    expect(isValidBuyerEmail('buyer@example.com')).toBe(true);
    expect(isValidBuyerEmail('  buyer+tag@catraca.local  ')).toBe(true);
    expect(isValidBuyerEmail('')).toBe(false);
    expect(isValidBuyerEmail('not-an-email')).toBe(false);
    expect(isValidBuyerEmail('missing@domain')).toBe(false);
  });

  it('rejects invalid cards and emails before touching DB or enqueuing jobs', async () => {
    const enqueued: PaymentJobPayload[] = [];
    const enqueuePayment = async (payload: PaymentJobPayload): Promise<void> => {
      enqueued.push(payload);
    };

    const invalidCards = ['123', 'abcdabcdabcdabcd', ''];
    for (const cardNumber of invalidCards) {
      const res = await purchaseTicket(
        {
          eventId: 'evt_nonexistent',
          buyerEmail: 'buyer@example.com',
          cardNumber,
          channel: 'partner',
        },
        { enqueuePayment },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('invalid_request');
      }
    }

    const badEmailRes = await purchaseTicket(
      {
        eventId: 'evt_nonexistent',
        buyerEmail: 'invalid-email',
        cardNumber: '4000000000000001',
        channel: 'web',
      },
      { enqueuePayment },
    );
    expect(badEmailRes.ok).toBe(false);
    if (!badEmailRes.ok) {
      expect(badEmailRes.error).toBe('invalid_request');
    }

    expect(enqueued).toHaveLength(0);
  });
});

describe('F03 — PostgreSQL Transactional Concurrency & Payment Worker Integration', () => {
  let dbAvailable = false;
  const runSuffix = randomBytes(4).toString('hex');
  const testOrganizerId = `usr_f03_org_${runSuffix}`;
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    dbAvailable = await isPostgresReachable();
    if (!dbAvailable) {
      return;
    }

    await db.insert(users).values({
      id: testOrganizerId,
      name: 'F03 Test Organizer',
      email: `f03.org.${runSuffix}@catraca.local`,
      passwordHash: 'test_hash_not_for_login',
      role: 'organizer',
    });
  });

  afterAll(async () => {
    if (dbAvailable) {
      if (createdEventIds.length > 0) {
        await db.delete(tickets).where(inArray(tickets.eventId, createdEventIds));
        await db.delete(events).where(inArray(events.id, createdEventIds));
      }
      await db.delete(users).where(eq(users.id, testOrganizerId));
    }
    await pool.end().catch(() => undefined);
  });

  async function createTestEvent(params: {
    name: string;
    capacity: number;
    priceCents: number;
    status: 'draft' | 'published' | 'cancelled';
  }): Promise<string> {
    const id = `evt_f03_${randomBytes(5).toString('hex')}`;
    await db.insert(events).values({
      id,
      organizerId: testOrganizerId,
      name: params.name,
      startsAt: new Date(Date.now() + 86_400_000),
      location: 'Auditório F03',
      capacity: params.capacity,
      priceCents: params.priceCents,
      status: params.status,
    });
    createdEventIds.push(id);
    return id;
  }

  it('rejects draft, cancelled, and non-existent events with event_not_available', async () => {
    if (!dbAvailable) {
      return;
    }

    const draftId = await createTestEvent({
      name: 'Draft Event',
      capacity: 10,
      priceCents: 5000,
      status: 'draft',
    });
    const cancelledId = await createTestEvent({
      name: 'Cancelled Event',
      capacity: 10,
      priceCents: 5000,
      status: 'cancelled',
    });

    const enqueuePayment = async (): Promise<void> => undefined;

    for (const eventId of [draftId, cancelledId, 'evt_does_not_exist']) {
      const result = await purchaseTicket(
        {
          eventId,
          buyerEmail: 'buyer@example.com',
          cardNumber: '4000000000000001',
          channel: 'partner',
        },
        { enqueuePayment },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('event_not_available');
      }
    }

    expect(await getEventAvailableSeats(cancelledId)).toBe(0);
  });

  it('reserves a pending ticket, decrements seats immediately, and snapshots priceCents', async () => {
    if (!dbAvailable) {
      return;
    }

    const eventId = await createTestEvent({
      name: 'Published F03 Event',
      capacity: 3,
      priceCents: 12500,
      status: 'published',
    });

    const enqueued: PaymentJobPayload[] = [];
    const result = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'Buyer@Example.com',
        cardNumber: '4000000000000001',
        channel: 'partner',
      },
      {
        enqueuePayment: async (payload) => {
          enqueued.push(payload);
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.ticket.status).toBe('pending');
    expect(result.ticket.ticketId).toMatch(/^tkt_[0-9a-f]{12}$/);
    expect(result.ticket.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(enqueued).toEqual([
      { ticketId: result.ticket.ticketId, cardLast4: '0001' },
    ]);

    expect(await getEventAvailableSeats(eventId)).toBe(2);

    const publishedList = await listPublishedEventsWithSeats();
    const listedEvent = publishedList.find((evt) => evt.id === eventId);
    expect(listedEvent).toBeDefined();
    expect(listedEvent?.availableSeats).toBe(2);

    const lookup = await getTicketById(result.ticket.ticketId);
    expect(lookup).toEqual({
      ticketId: result.ticket.ticketId,
      code: result.ticket.code,
      eventId,
      status: 'pending',
      checkedIn: false,
    });
  });

  it('prevents overselling under 2 rounds x 30 concurrent purchases for capacity 5 (R07)', async () => {
    if (!dbAvailable) {
      return;
    }

    const enqueuePayment = async (): Promise<void> => undefined;

    for (let round = 1; round <= 2; round += 1) {
      const eventId = await createTestEvent({
        name: `Burst Concurrency Round ${round}`,
        capacity: 5,
        priceCents: 8000,
        status: 'published',
      });

      const attempts = Array.from({ length: 30 }, (_, idx) =>
        purchaseTicket(
          {
            eventId,
            buyerEmail: `burst.r${round}.u${idx}@example.com`,
            cardNumber: '4000000000000001',
            channel: 'partner',
          },
          { enqueuePayment },
        ),
      );

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r.ok);
      const soldOut = results.filter((r) => !r.ok && r.error === 'sold_out');

      expect(successes).toHaveLength(5);
      expect(soldOut).toHaveLength(25);
      expect(await getEventAvailableSeats(eventId)).toBe(0);

      const dbTickets = await db
        .select()
        .from(tickets)
        .where(eq(tickets.eventId, eventId));
      expect(dbTickets).toHaveLength(5);
    }
  });

  it('processes simulated payment outcomes and releases seat on decline (R08)', async () => {
    if (!dbAvailable) {
      return;
    }

    const eventId = await createTestEvent({
      name: 'Gateway Outcomes Event',
      capacity: 5,
      priceCents: 10000,
      status: 'published',
    });

    const enqueuePayment = async (): Promise<void> => undefined;

    const purchase0001 = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'card0001@example.com',
        cardNumber: '4000000000000001',
        channel: 'web',
      },
      { enqueuePayment },
    );
    const purchase0002 = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'card0002@example.com',
        cardNumber: '4000000000000002',
        channel: 'partner',
      },
      { enqueuePayment },
    );
    const purchase9999 = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'card9999@example.com',
        cardNumber: '4000000000009999',
        channel: 'partner',
      },
      { enqueuePayment },
    );

    expect(purchase0001.ok && purchase0002.ok && purchase9999.ok).toBe(true);
    if (!purchase0001.ok || !purchase0002.ok || !purchase9999.ok) {
      return;
    }

    expect(await getEventAvailableSeats(eventId)).toBe(2);

    const res0001 = await processPaymentJob(
      { ticketId: purchase0001.ticket.ticketId, cardLast4: '0001' },
      { delayScale: 0 },
    );
    expect(res0001.updated).toBe(true);
    expect(res0001.finalStatus).toBe('confirmed');

    const res0002 = await processPaymentJob(
      { ticketId: purchase0002.ticket.ticketId, cardLast4: '0002' },
      { delayScale: 0 },
    );
    expect(res0002.updated).toBe(true);
    expect(res0002.finalStatus).toBe('declined');

    const res9999 = await processPaymentJob(
      { ticketId: purchase9999.ticket.ticketId, cardLast4: '9999' },
      { delayScale: 0 },
    );
    expect(res9999.updated).toBe(true);
    expect(res9999.finalStatus).toBe('declined');

    // Only purchase0001 remains occupied (confirmed); 0002 and 9999 freed their seats.
    expect(await getEventAvailableSeats(eventId)).toBe(4);
  });

  it('guards against late gateway responses on cancelled ticket or cancelled event (R11)', async () => {
    if (!dbAvailable) {
      return;
    }

    const eventId = await createTestEvent({
      name: 'R11 Guard Event',
      capacity: 5,
      priceCents: 15000,
      status: 'published',
    });

    const enqueuePayment = async (): Promise<void> => undefined;

    const t1 = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'late1@example.com',
        cardNumber: '4000000000000003',
        channel: 'partner',
      },
      { enqueuePayment },
    );
    const t2 = await purchaseTicket(
      {
        eventId,
        buyerEmail: 'late2@example.com',
        cardNumber: '4000000000000003',
        channel: 'web',
      },
      { enqueuePayment },
    );

    expect(t1.ok && t2.ok).toBe(true);
    if (!t1.ok || !t2.ok) {
      return;
    }

    // Case 1: Ticket already cancelled while event is still published
    await db
      .update(tickets)
      .set({ status: 'cancelled' })
      .where(eq(tickets.id, t1.ticket.ticketId));

    const lateOnCancelledTicket = await processPaymentJob(
      { ticketId: t1.ticket.ticketId, cardLast4: '0003' },
      { delayScale: 0 },
    );
    expect(lateOnCancelledTicket.updated).toBe(false);
    expect(lateOnCancelledTicket.finalStatus).toBeNull();
    expect((await getTicketById(t1.ticket.ticketId))?.status).toBe('cancelled');

    // Case 2: Event cancelled while ticket t2 is still pending
    await db
      .update(events)
      .set({ status: 'cancelled' })
      .where(eq(events.id, eventId));

    const lateOnCancelledEvent = await processPaymentJob(
      { ticketId: t2.ticket.ticketId, cardLast4: '0003' },
      { delayScale: 0 },
    );
    expect(lateOnCancelledEvent.updated).toBe(false);
    expect(lateOnCancelledEvent.finalStatus).toBeNull();
    expect((await getTicketById(t2.ticket.ticketId))?.status).toBe('pending');
    expect(await getEventAvailableSeats(eventId)).toBe(0);
  });
});
