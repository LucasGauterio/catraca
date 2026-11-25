import { describe, expect, it } from 'vitest';
import type { EventStatus, TicketStatus } from '../src/db/schema';
import {
  formatBrlFromCents,
  formatEventDateTimePtBr,
  getTicketStatusLabel,
  isEventSoldOut,
  isEventVisibleOnStorefront,
  SOLD_OUT_LABEL,
  TICKET_STATUS_LABELS,
} from '../src/lib/tickets/labels';

describe('F04 — Ticket status PT-BR labels (R09)', () => {
  it('maps all 5 ticket statuses to exact PT-BR labels required by brief.md', () => {
    const expected: Record<TicketStatus, string> = {
      pending: 'pendente',
      confirmed: 'confirmado',
      declined: 'recusado',
      cancelled: 'cancelado',
      refunded: 'estornado',
    };

    expect(TICKET_STATUS_LABELS).toEqual(expected);
    for (const [status, label] of Object.entries(expected) as [TicketStatus, string][]) {
      expect(getTicketStatusLabel(status)).toBe(label);
    }
  });
});

describe('F04 — BRL currency formatter', () => {
  it('formats cents into exact R$ X,XX strings with standard space', () => {
    expect(formatBrlFromCents(10000)).toBe('R$ 100,00');
    expect(formatBrlFromCents(35000)).toBe('R$ 350,00');
    expect(formatBrlFromCents(0)).toBe('R$ 0,00');
    expect(formatBrlFromCents(50)).toBe('R$ 0,50');
    expect(formatBrlFromCents(123456)).toBe('R$ 1.234,56');
    expect(formatBrlFromCents(-10000)).toBe('-R$ 100,00');
  });
});

describe('F04 — Storefront visibility (R02) and sold-out state (R07)', () => {
  it('allows only published events on the public storefront', () => {
    const statuses: [EventStatus, boolean][] = [
      ['published', true],
      ['draft', false],
      ['cancelled', false],
    ];

    for (const [status, expectedVisible] of statuses) {
      expect(isEventVisibleOnStorefront(status)).toBe(expectedVisible);
    }
  });

  it('detects sold-out events when availableSeats <= 0 and exposes exact label', () => {
    expect(SOLD_OUT_LABEL).toBe('Ingressos esgotados');
    expect(isEventSoldOut(0)).toBe(true);
    expect(isEventSoldOut(-1)).toBe(true);
    expect(isEventSoldOut(1)).toBe(false);
    expect(isEventSoldOut(50)).toBe(false);
  });

  it('formats event start date/time in PT-BR and handles invalid dates safely', () => {
    const formatted = formatEventDateTimePtBr('2026-12-01T22:00:00.000Z');
    expect(formatted).toContain('01/12/2026');
    expect(formatEventDateTimePtBr('invalid-date')).toBe('');
  });
});
