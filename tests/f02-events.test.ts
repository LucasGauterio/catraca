import { describe, expect, it } from 'vitest';
import {
  centsToInputBrl,
  formatPriceBrl,
  getEventStatusMeta,
  isEventOwnedByOrganizer,
  parseBrlToCents,
  validateCapacityAgainstOccupied,
  validateEventInput,
} from '@/lib/events/utils';

describe('F02 — Gestão de Eventos (R01, R02, R03, R05, R13)', () => {
  const fixedNow = new Date('2026-06-01T12:00:00.000Z');
  const futureDateIso = '2026-06-15T20:00:00.000Z';
  const yesterdayIso = '2026-05-31T12:00:00.000Z';

  describe('validateEventInput (R01)', () => {
    it('accepts valid future event input and trims text fields', () => {
      const result = validateEventInput(
        {
          name: '  Show de Jazz  ',
          startsAt: futureDateIso,
          location: '  Teatro Municipal  ',
          capacity: 120,
          priceCents: 15000,
        },
        fixedNow,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Show de Jazz');
        expect(result.data.location).toBe('Teatro Municipal');
        expect(result.data.startsAt.toISOString()).toBe(futureDateIso);
        expect(result.data.capacity).toBe(120);
        expect(result.data.priceCents).toBe(15000);
      }
    });

    it('rejects events with start date in the past or equal to now (R01)', () => {
      const pastResult = validateEventInput(
        {
          name: 'Evento Passado',
          startsAt: yesterdayIso,
          location: 'Auditório',
          capacity: 50,
          priceCents: 5000,
        },
        fixedNow,
      );
      expect(pastResult.ok).toBe(false);

      const equalNowResult = validateEventInput(
        {
          name: 'Evento Agora',
          startsAt: fixedNow.toISOString(),
          location: 'Auditório',
          capacity: 50,
          priceCents: 5000,
        },
        fixedNow,
      );
      expect(equalNowResult.ok).toBe(false);
    });

    it('rejects empty name, empty location, invalid date, capacity < 1, and priceCents <= 0', () => {
      expect(
        validateEventInput(
          {
            name: '   ',
            startsAt: futureDateIso,
            location: 'Local',
            capacity: 10,
            priceCents: 1000,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: futureDateIso,
            location: '',
            capacity: 10,
            priceCents: 1000,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: 'not-a-date',
            location: 'Local',
            capacity: 10,
            priceCents: 1000,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: futureDateIso,
            location: 'Local',
            capacity: 0,
            priceCents: 1000,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: futureDateIso,
            location: 'Local',
            capacity: 10.5,
            priceCents: 1000,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: futureDateIso,
            location: 'Local',
            capacity: 10,
            priceCents: 0,
          },
          fixedNow,
        ).ok,
      ).toBe(false);

      expect(
        validateEventInput(
          {
            name: 'Evento',
            startsAt: futureDateIso,
            location: 'Local',
            capacity: 10,
            priceCents: -500,
          },
          fixedNow,
        ).ok,
      ).toBe(false);
    });
  });

  describe('validateCapacityAgainstOccupied (R03, R05)', () => {
    it('rejects reducing capacity below currently occupied seats (pending + confirmed)', () => {
      const result = validateCapacityAgainstOccupied(2, 3);
      expect(result.ok).toBe(false);
    });

    it('allows setting capacity equal to or greater than occupied seats', () => {
      expect(validateCapacityAgainstOccupied(3, 3).ok).toBe(true);
      expect(validateCapacityAgainstOccupied(10, 3).ok).toBe(true);
      expect(validateCapacityAgainstOccupied(1, 0).ok).toBe(true);
    });

    it('rejects capacity less than 1 even with zero occupied seats', () => {
      expect(validateCapacityAgainstOccupied(0, 0).ok).toBe(false);
    });
  });

  describe('isEventOwnedByOrganizer (R13)', () => {
    it('allows only the owning organizer and blocks other organizers or empty values', () => {
      const eventOfOrgA = { organizerId: 'usr_org_a' };
      expect(isEventOwnedByOrganizer(eventOfOrgA, 'usr_org_a')).toBe(true);
      expect(isEventOwnedByOrganizer(eventOfOrgA, 'usr_org_b')).toBe(false);
      expect(isEventOwnedByOrganizer(eventOfOrgA, '')).toBe(false);
      expect(isEventOwnedByOrganizer(null, 'usr_org_a')).toBe(false);
      expect(isEventOwnedByOrganizer(undefined, 'usr_org_a')).toBe(false);
    });
  });

  describe('formatting and parsing helpers', () => {
    it('formats cents into BRL currency strings and editable input strings', () => {
      expect(formatPriceBrl(10000)).toBe('R$ 100,00');
      expect(formatPriceBrl(4990)).toBe('R$ 49,90');
      expect(centsToInputBrl(10050)).toBe('100,50');
    });

    it('parses valid BRL strings into positive integer cents and rejects invalid inputs', () => {
      expect(parseBrlToCents('100,00')).toBe(10000);
      expect(parseBrlToCents('49.90')).toBe(4990);
      expect(parseBrlToCents('1.250,50')).toBe(125050);
      expect(parseBrlToCents('R$ 80,00')).toBe(8000);
      expect(parseBrlToCents('0')).toBeNull();
      expect(parseBrlToCents('-10,00')).toBeNull();
      expect(parseBrlToCents('abc')).toBeNull();
      expect(parseBrlToCents('')).toBeNull();
    });

    it('returns localized status badges for draft, published, and cancelled', () => {
      expect(getEventStatusMeta('draft').label).toBe('Rascunho');
      expect(getEventStatusMeta('published').label).toBe('Publicado');
      expect(getEventStatusMeta('cancelled').label).toBe('Cancelado');
    });
  });
});
