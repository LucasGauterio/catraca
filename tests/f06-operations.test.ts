import { describe, expect, it } from 'vitest';
import {
  computeEventDashboard,
  evaluateCheckInDecision,
  type EventDashboardTicketRow,
} from '@/lib/events/operations';

describe('F06 — Check-in, Painel de Gestão e Cancelamento Irreversível (R10, R11, R12)', () => {
  describe('evaluateCheckInDecision — ordem estrita de precedência R10', () => {
    it('1. returns "Ingresso inválido para este evento" when code does not exist or belongs to another event', () => {
      const result = evaluateCheckInDecision({
        ticketFoundForEvent: false,
        eventStatus: 'published',
        ticketStatus: null,
        alreadyCheckedIn: false,
      });

      expect(result).toEqual({
        ok: false,
        message: 'Ingresso inválido para este evento',
      });
    });

    it('1b. prioritizes "Ingresso inválido para este evento" BEFORE "Evento cancelado" when code is invalid on a cancelled event', () => {
      const result = evaluateCheckInDecision({
        ticketFoundForEvent: false,
        eventStatus: 'cancelled',
        ticketStatus: null,
        alreadyCheckedIn: false,
      });

      expect(result).toEqual({
        ok: false,
        message: 'Ingresso inválido para este evento',
      });
    });

    it('2. returns "Evento cancelado" when ticket belongs to event and event is cancelled (even if ticket is refunded/cancelled or checked in)', () => {
      const refundedTicket = evaluateCheckInDecision({
        ticketFoundForEvent: true,
        eventStatus: 'cancelled',
        ticketStatus: 'refunded',
        alreadyCheckedIn: false,
      });
      expect(refundedTicket).toEqual({
        ok: false,
        message: 'Evento cancelado',
      });

      const checkedInBeforeCancel = evaluateCheckInDecision({
        ticketFoundForEvent: true,
        eventStatus: 'cancelled',
        ticketStatus: 'refunded',
        alreadyCheckedIn: true,
      });
      expect(checkedInBeforeCancel).toEqual({
        ok: false,
        message: 'Evento cancelado',
      });
    });

    it('3. returns "Ingresso não confirmado" for pending, declined, cancelled, or refunded tickets on a non-cancelled event', () => {
      for (const status of ['pending', 'declined', 'cancelled', 'refunded'] as const) {
        const result = evaluateCheckInDecision({
          ticketFoundForEvent: true,
          eventStatus: 'published',
          ticketStatus: status,
          alreadyCheckedIn: false,
        });
        expect(result).toEqual({
          ok: false,
          message: 'Ingresso não confirmado',
        });
      }
    });

    it('4. returns "Ingresso já utilizado" when confirmed ticket was already checked in', () => {
      const result = evaluateCheckInDecision({
        ticketFoundForEvent: true,
        eventStatus: 'published',
        ticketStatus: 'confirmed',
        alreadyCheckedIn: true,
      });

      expect(result).toEqual({
        ok: false,
        message: 'Ingresso já utilizado',
      });
    });

    it('5. returns "Entrada liberada" when ticket is valid, event is not cancelled, ticket is confirmed, and not yet checked in', () => {
      const result = evaluateCheckInDecision({
        ticketFoundForEvent: true,
        eventStatus: 'published',
        ticketStatus: 'confirmed',
        alreadyCheckedIn: false,
      });

      expect(result).toEqual({
        ok: true,
        message: 'Entrada liberada',
      });
    });
  });

  describe('computeEventDashboard — fórmulas do painel R12, R03, R05 e R11', () => {
    it('computes revenue using historical ticket prices (2x R$ 100,00 + 1x R$ 150,00 = R$ 350,00) and includes checked-in tickets in confirmed count', () => {
      const tickets: EventDashboardTicketRow[] = [
        { status: 'confirmed', priceCents: 10000, checkedIn: true },
        { status: 'confirmed', priceCents: 10000, checkedIn: false },
        { status: 'confirmed', priceCents: 15000, checkedIn: false },
        { status: 'declined', priceCents: 10000, checkedIn: false },
      ];

      const metrics = computeEventDashboard({ status: 'published', capacity: 3 }, tickets);

      expect(metrics).toEqual({
        confirmed: 3,
        pending: 0,
        checkedIn: 1,
        availableSeats: 0,
        revenueCents: 35000,
        revenueFormatted: 'R$ 350,00',
        refunded: 0,
      });
    });

    it('counts pending tickets in occupied seats without counting them as revenue (R05, R12)', () => {
      const tickets: EventDashboardTicketRow[] = [
        { status: 'confirmed', priceCents: 5000, checkedIn: false },
        { status: 'pending', priceCents: 5000, checkedIn: false },
        { status: 'pending', priceCents: 7500, checkedIn: false },
      ];

      const metrics = computeEventDashboard({ status: 'published', capacity: 5 }, tickets);

      expect(metrics).toEqual({
        confirmed: 1,
        pending: 2,
        checkedIn: 0,
        availableSeats: 2,
        revenueCents: 5000,
        revenueFormatted: 'R$ 50,00',
        refunded: 0,
      });
    });

    it('returns availableSeats 0, revenueCents 0 (R$ 0,00), and refunded 1 for a cancelled event (R05, R11, R12)', () => {
      const tickets: EventDashboardTicketRow[] = [
        { status: 'refunded', priceCents: 5000, checkedIn: false },
        { status: 'cancelled', priceCents: 5000, checkedIn: false },
      ];

      const metrics = computeEventDashboard({ status: 'cancelled', capacity: 5 }, tickets);

      expect(metrics).toEqual({
        confirmed: 0,
        pending: 0,
        checkedIn: 0,
        availableSeats: 0,
        revenueCents: 0,
        revenueFormatted: 'R$ 0,00',
        refunded: 1,
      });
    });
  });
});
