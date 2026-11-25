import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashApiKey } from '@/lib/auth-utils';
import {
  serializePartnerEvent,
  serializePartnerTicket,
  validatePartnerPurchaseBody,
} from '@/lib/partner-validation';

const mockVerifyPartnerApiKey = vi.fn<(rawKey: string | null | undefined) => Promise<boolean>>();
const mockListPublishedEventsWithSeats = vi.fn();
const mockGetTicketById = vi.fn();
const mockPurchaseTicket = vi.fn();

vi.mock('@/lib/auth', () => ({
  verifyPartnerApiKey: (rawKey: string | null | undefined) => mockVerifyPartnerApiKey(rawKey),
}));

vi.mock('@/lib/tickets/queries', () => ({
  listPublishedEventsWithSeats: () => mockListPublishedEventsWithSeats(),
  getTicketById: (ticketId: string) => mockGetTicketById(ticketId),
}));

vi.mock('@/lib/tickets/purchase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tickets/purchase')>();
  return {
    ...actual,
    purchaseTicket: (input: unknown) => mockPurchaseTicket(input),
  };
});

import {
  authenticatePartnerRequest,
  extractPartnerApiKey,
  unauthorizedPartnerResponse,
  validatePartnerApiKey,
} from '@/lib/partner-auth';
import { GET as getPartnerEvents } from '@/app/api/partner/events/route';
import { POST as postPartnerPurchase } from '@/app/api/partner/events/[eventId]/purchases/route';
import { GET as getPartnerTicket } from '@/app/api/partner/tickets/[ticketId]/route';

const VALID_KEY = 'catraca-partner-key-2026';

describe('F05 — API de Parceiros (Contrato Fixo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPartnerApiKey.mockImplementation(async (rawKey) => rawKey?.trim() === VALID_KEY);
  });

  describe('partner-auth helpers', () => {
    it('hashes partner API keys deterministically using SHA-256 hex', () => {
      const digest = hashApiKey(VALID_KEY);
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
      expect(hashApiKey(VALID_KEY)).toBe(digest);
      expect(hashApiKey('wrong-key')).not.toBe(digest);
    });

    it('extracts X-Api-Key case-insensitively and trims whitespace', () => {
      const req = new Request('http://localhost:3000/api/partner/events', {
        headers: { 'X-Api-Key': `  ${VALID_KEY}  ` },
      });
      expect(extractPartnerApiKey(req)).toBe(VALID_KEY);

      const blankReq = new Request('http://localhost:3000/api/partner/events', {
        headers: { 'X-Api-Key': '   ' },
      });
      expect(extractPartnerApiKey(blankReq)).toBeNull();

      const missingReq = new Request('http://localhost:3000/api/partner/events');
      expect(extractPartnerApiKey(missingReq)).toBeNull();
    });

    it('validates active partner API keys and rejects missing/invalid keys', async () => {
      const validReq = new Request('http://localhost:3000/api/partner/events', {
        headers: { 'X-Api-Key': VALID_KEY },
      });
      expect(await validatePartnerApiKey(validReq)).toBe(true);
      expect(await authenticatePartnerRequest(validReq)).toBeNull();

      const invalidReq = new Request('http://localhost:3000/api/partner/events', {
        headers: { 'X-Api-Key': 'errada' },
      });
      expect(await validatePartnerApiKey(invalidReq)).toBe(false);
      const unauthorizedRes = await authenticatePartnerRequest(invalidReq);
      expect(unauthorizedRes?.status).toBe(401);
      expect(await unauthorizedRes?.json()).toEqual({ error: 'unauthorized' });

      const directUnauthorized = unauthorizedPartnerResponse();
      expect(directUnauthorized.status).toBe(401);
      expect(await directUnauthorized.json()).toEqual({ error: 'unauthorized' });
    });
  });

  describe('validatePartnerPurchaseBody (422 rules)', () => {
    it('accepts valid buyerEmail and 16-digit cardNumber', () => {
      const result = validatePartnerPurchaseBody({
        buyerEmail: '  ana@example.com  ',
        cardNumber: '4000000000000001',
      });
      expect(result).toEqual({
        ok: true,
        data: {
          buyerEmail: 'ana@example.com',
          cardNumber: '4000000000000001',
        },
      });
    });

    it('rejects missing fields, malformed email, non-16-digit cards, and non-object payloads', () => {
      const invalidPayloads: unknown[] = [
        null,
        undefined,
        'string',
        ['ana@example.com', '4000000000000001'],
        {},
        { buyerEmail: 'ana@example.com' },
        { cardNumber: '4000000000000001' },
        { buyerEmail: 'not-an-email', cardNumber: '4000000000000001' },
        { buyerEmail: 'ana@example.com', cardNumber: '123' },
        { buyerEmail: 'ana@example.com', cardNumber: '40000000000000001' },
        { buyerEmail: 'ana@example.com', cardNumber: '400000000000000a' },
        { buyerEmail: 'ana@example.com', cardNumber: 4000000000000001 },
      ];

      for (const payload of invalidPayloads) {
        expect(validatePartnerPurchaseBody(payload)).toEqual({
          ok: false,
          error: 'invalid_request',
        });
      }
    });
  });

  describe('serializers (exact contract shapes)', () => {
    it('serializes published event with exact 5 fields and ISO-8601 startsAt', () => {
      const startsAt = new Date('2026-12-05T21:00:00.000Z');
      const serialized = serializePartnerEvent({
        id: 'evt_8f2k',
        organizerId: 'usr_organizer_a',
        name: 'Jazz no Porão',
        startsAt,
        location: 'Porão Central',
        capacity: 10,
        priceCents: 10000,
        status: 'published',
        availableSeats: 2,
      });

      expect(serialized).toEqual({
        id: 'evt_8f2k',
        name: 'Jazz no Porão',
        startsAt: '2026-12-05T21:00:00.000Z',
        priceCents: 10000,
        availableSeats: 2,
      });
      expect(Object.keys(serialized).sort()).toEqual([
        'availableSeats',
        'id',
        'name',
        'priceCents',
        'startsAt',
      ]);
    });

    it('serializes ticket lookup with exact 5 fields', () => {
      const serialized = serializePartnerTicket({
        ticketId: 'tkt_51xq',
        code: 'K7Q2M9XA',
        eventId: 'evt_8f2k',
        status: 'confirmed',
        checkedIn: false,
      });

      expect(serialized).toEqual({
        ticketId: 'tkt_51xq',
        code: 'K7Q2M9XA',
        eventId: 'evt_8f2k',
        status: 'confirmed',
        checkedIn: false,
      });
      expect(Object.keys(serialized).sort()).toEqual([
        'checkedIn',
        'code',
        'eventId',
        'status',
        'ticketId',
      ]);
    });
  });

  describe('GET /api/partner/events', () => {
    it('returns 401 unauthorized when X-Api-Key is missing or invalid', async () => {
      const missingRes = await getPartnerEvents(
        new Request('http://localhost:3000/api/partner/events'),
      );
      expect(missingRes.status).toBe(401);
      expect(await missingRes.json()).toEqual({ error: 'unauthorized' });

      const wrongRes = await getPartnerEvents(
        new Request('http://localhost:3000/api/partner/events', {
          headers: { 'X-Api-Key': 'errada' },
        }),
      );
      expect(wrongRes.status).toBe(401);
      expect(await wrongRes.json()).toEqual({ error: 'unauthorized' });
      expect(mockListPublishedEventsWithSeats).not.toHaveBeenCalled();
    });

    it('returns 200 with exact contract array for published events', async () => {
      mockListPublishedEventsWithSeats.mockResolvedValue([
        {
          id: 'evt_8f2k',
          organizerId: 'usr_organizer_a',
          name: 'Jazz no Porão',
          startsAt: new Date('2026-12-05T21:00:00.000Z'),
          location: 'Rua A, 100',
          capacity: 5,
          priceCents: 10000,
          status: 'published',
          availableSeats: 2,
        },
      ]);

      const res = await getPartnerEvents(
        new Request('http://localhost:3000/api/partner/events', {
          headers: { 'X-Api-Key': VALID_KEY },
        }),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([
        {
          id: 'evt_8f2k',
          name: 'Jazz no Porão',
          startsAt: '2026-12-05T21:00:00.000Z',
          priceCents: 10000,
          availableSeats: 2,
        },
      ]);
    });
  });

  describe('POST /api/partner/events/[eventId]/purchases', () => {
    const context = { params: Promise.resolve({ eventId: 'evt_8f2k' }) };

    it('checks 401 before 422 even when body is invalid', async () => {
      const req = new Request('http://localhost:3000/api/partner/events/evt_8f2k/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'errada' },
        body: '{invalid-json',
      });

      const res = await postPartnerPurchase(req, context);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
      expect(mockPurchaseTicket).not.toHaveBeenCalled();
    });

    it('returns 422 invalid_request on malformed JSON or invalid cardNumber before checking event existence', async () => {
      const badJsonReq = new Request(
        'http://localhost:3000/api/partner/events/evt_missing/purchases',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': VALID_KEY },
          body: '{broken',
        },
      );
      const badJsonRes = await postPartnerPurchase(badJsonReq, {
        params: Promise.resolve({ eventId: 'evt_missing' }),
      });
      expect(badJsonRes.status).toBe(422);
      expect(await badJsonRes.json()).toEqual({ error: 'invalid_request' });

      const badCardReq = new Request(
        'http://localhost:3000/api/partner/events/evt_missing/purchases',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': VALID_KEY },
          body: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '123' }),
        },
      );
      const badCardRes = await postPartnerPurchase(badCardReq, {
        params: Promise.resolve({ eventId: 'evt_missing' }),
      });
      expect(badCardRes.status).toBe(422);
      expect(await badCardRes.json()).toEqual({ error: 'invalid_request' });
      expect(mockPurchaseTicket).not.toHaveBeenCalled();
    });

    it('returns 404 event_not_available when event does not exist, is draft, or is cancelled', async () => {
      mockPurchaseTicket.mockResolvedValue({
        ok: false,
        error: 'event_not_available',
        message: 'Event is not available for purchase.',
      });

      const req = new Request('http://localhost:3000/api/partner/events/evt_draft/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': VALID_KEY },
        body: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
      });

      const res = await postPartnerPurchase(req, {
        params: Promise.resolve({ eventId: 'evt_draft' }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'event_not_available' });
    });

    it('returns 409 sold_out when event has no available seats', async () => {
      mockPurchaseTicket.mockResolvedValue({
        ok: false,
        error: 'sold_out',
        message: 'Event has no available seats.',
      });

      const req = new Request('http://localhost:3000/api/partner/events/evt_full/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': VALID_KEY },
        body: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
      });

      const res = await postPartnerPurchase(req, {
        params: Promise.resolve({ eventId: 'evt_full' }),
      });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'sold_out' });
    });

    it('returns 202 with pending ticket summary and delegates with channel=partner, userId=null', async () => {
      mockPurchaseTicket.mockResolvedValue({
        ok: true,
        ticket: {
          ticketId: 'tkt_51xq',
          code: 'K7Q2M9XA',
          status: 'pending',
        },
      });

      const req = new Request('http://localhost:3000/api/partner/events/evt_8f2k/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': VALID_KEY },
        body: JSON.stringify({ buyerEmail: 'ana@example.com', cardNumber: '4000000000000001' }),
      });

      const res = await postPartnerPurchase(req, context);
      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({
        ticketId: 'tkt_51xq',
        code: 'K7Q2M9XA',
        status: 'pending',
      });
      expect(mockPurchaseTicket).toHaveBeenCalledWith({
        eventId: 'evt_8f2k',
        buyerEmail: 'ana@example.com',
        cardNumber: '4000000000000001',
        channel: 'partner',
        userId: null,
      });
    });
  });

  describe('GET /api/partner/tickets/[ticketId]', () => {
    it('returns 401 unauthorized without valid X-Api-Key', async () => {
      const res = await getPartnerTicket(
        new Request('http://localhost:3000/api/partner/tickets/tkt_51xq'),
        { params: Promise.resolve({ ticketId: 'tkt_51xq' }) },
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
      expect(mockGetTicketById).not.toHaveBeenCalled();
    });

    it('returns 404 ticket_not_found when ticket does not exist', async () => {
      mockGetTicketById.mockResolvedValue(null);

      const res = await getPartnerTicket(
        new Request('http://localhost:3000/api/partner/tickets/tkt_unknown', {
          headers: { 'X-Api-Key': VALID_KEY },
        }),
        { params: Promise.resolve({ ticketId: 'tkt_unknown' }) },
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'ticket_not_found' });
    });

    it('returns 200 with exact ticket fields for existing tickets from any channel', async () => {
      mockGetTicketById.mockResolvedValue({
        ticketId: 'tkt_51xq',
        code: 'K7Q2M9XA',
        eventId: 'evt_8f2k',
        status: 'confirmed',
        checkedIn: false,
      });

      const res = await getPartnerTicket(
        new Request('http://localhost:3000/api/partner/tickets/tkt_51xq', {
          headers: { 'X-Api-Key': VALID_KEY },
        }),
        { params: Promise.resolve({ ticketId: 'tkt_51xq' }) },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ticketId: 'tkt_51xq',
        code: 'K7Q2M9XA',
        eventId: 'evt_8f2k',
        status: 'confirmed',
        checkedIn: false,
      });
    });
  });
});
