import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatPriceBrl,
  getTicketStatusLabel,
  mapPurchaseErrorToHttp,
} from '@/components/storefront/formatters';

const mockGetSessionUser = vi.fn();
const mockPurchaseTicket = vi.fn();

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getSessionUser: (...args: unknown[]) => mockGetSessionUser(...args),
  };
});

vi.mock('@/lib/tickets/purchase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tickets/purchase')>();
  return {
    ...actual,
    purchaseTicket: (...args: unknown[]) => mockPurchaseTicket(...args),
  };
});

import { POST as purchasePost } from '@/app/api/purchases/route';

describe('F04 — Storefront formatters and status labels (R09)', () => {
  it('maps all 5 ticket statuses to exact Portuguese labels', () => {
    expect(getTicketStatusLabel('pending')).toBe('pendente');
    expect(getTicketStatusLabel('confirmed')).toBe('confirmado');
    expect(getTicketStatusLabel('declined')).toBe('recusado');
    expect(getTicketStatusLabel('cancelled')).toBe('cancelado');
    expect(getTicketStatusLabel('refunded')).toBe('estornado');
  });

  it('formats integer cents into BRL currency strings', () => {
    expect(formatPriceBrl(10000)).toBe('R$ 100,00');
    expect(formatPriceBrl(15000)).toBe('R$ 150,00');
    expect(formatPriceBrl(0)).toBe('R$ 0,00');
    expect(formatPriceBrl(123456)).toBe('R$ 1.234,56');
  });

  it('maps domain purchase errors to exact HTTP status codes and R07 sold_out message', () => {
    const invalid = mapPurchaseErrorToHttp('invalid_request', 'Cartão inválido');
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      error: 'invalid_request',
      message: 'Cartão inválido',
    });

    const unavailable = mapPurchaseErrorToHttp('event_not_available', 'Evento indisponível');
    expect(unavailable.status).toBe(404);
    expect(unavailable.body).toEqual({
      error: 'event_not_available',
      message: 'Evento indisponível',
    });

    const soldOut = mapPurchaseErrorToHttp('sold_out', 'Event has no available seats.');
    expect(soldOut.status).toBe(409);
    expect(soldOut.body).toEqual({
      error: 'sold_out',
      message: 'Ingressos esgotados',
    });
  });
});

describe('F04 — POST /api/purchases route handler (R06, R07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is unauthenticated', async () => {
    mockGetSessionUser.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_1', cardNumber: '4000000000000001' }),
    });

    const res = await purchasePost(req);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  it('returns 422 when request JSON or purchase payload is invalid', async () => {
    mockGetSessionUser.mockResolvedValueOnce({
      id: 'usr_part1',
      name: 'Participante',
      email: 'part@catraca.local',
      role: 'participant',
    });
    mockPurchaseTicket.mockResolvedValueOnce({
      ok: false,
      error: 'invalid_request',
      message: 'Invalid purchase request',
    });

    const req = new NextRequest('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_1', cardNumber: '123' }),
    });

    const res = await purchasePost(req);
    const body = (await res.json()) as { error: string; message: string };

    expect(res.status).toBe(422);
    expect(body.error).toBe('invalid_request');
  });

  it('returns 404 when event is not available (draft, cancelled, or missing)', async () => {
    mockGetSessionUser.mockResolvedValueOnce({
      id: 'usr_part1',
      name: 'Participante',
      email: 'part@catraca.local',
      role: 'participant',
    });
    mockPurchaseTicket.mockResolvedValueOnce({
      ok: false,
      error: 'event_not_available',
      message: 'Event is not available for purchase.',
    });

    const req = new NextRequest('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_draft', cardNumber: '4000000000000001' }),
    });

    const res = await purchasePost(req);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('event_not_available');
  });

  it('returns 409 with literal "Ingressos esgotados" when event is sold out (R07)', async () => {
    mockGetSessionUser.mockResolvedValueOnce({
      id: 'usr_part1',
      name: 'Participante',
      email: 'part@catraca.local',
      role: 'participant',
    });
    mockPurchaseTicket.mockResolvedValueOnce({
      ok: false,
      error: 'sold_out',
      message: 'Event has no available seats.',
    });

    const req = new NextRequest('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_full', cardNumber: '4000000000000001' }),
    });

    const res = await purchasePost(req);
    const body = (await res.json()) as { error: string; message: string };

    expect(res.status).toBe(409);
    expect(body).toEqual({
      error: 'sold_out',
      message: 'Ingressos esgotados',
    });
  });

  it('returns 202 with pending ticket summary on valid purchase (R06)', async () => {
    mockGetSessionUser.mockResolvedValueOnce({
      id: 'usr_part1',
      name: 'Participante',
      email: 'part@catraca.local',
      role: 'participant',
    });
    mockPurchaseTicket.mockResolvedValueOnce({
      ok: true,
      ticket: {
        ticketId: 'tkt_abc123',
        code: 'K7Q2M9XA',
        status: 'pending',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'evt_pub', cardNumber: '4000000000000001' }),
    });

    const res = await purchasePost(req);
    const body = (await res.json()) as { ticketId: string; code: string; status: string };

    expect(res.status).toBe(202);
    expect(body).toEqual({
      ticketId: 'tkt_abc123',
      code: 'K7Q2M9XA',
      status: 'pending',
    });
    expect(mockPurchaseTicket).toHaveBeenCalledWith({
      eventId: 'evt_pub',
      buyerEmail: 'part@catraca.local',
      cardNumber: '4000000000000001',
      channel: 'web',
      userId: 'usr_part1',
    });
  });
});
