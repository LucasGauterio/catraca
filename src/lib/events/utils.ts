import type { EventStatus } from '@/db/schema';

export interface EventInput {
  name: string;
  startsAt: string | Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export interface ValidatedEventInput {
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export type EventValidationResult =
  | { ok: true; data: ValidatedEventInput }
  | { ok: false; error: string };

export interface SerializedEvent {
  id: string;
  organizerId: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerEventWithOccupancy extends SerializedEvent {
  occupiedSeats: number;
  availableSeats: number;
}

/**
 * Validates event creation/editing input against R01 rules:
 * non-empty name & location, future `startsAt`, integer `capacity >= 1`, integer `priceCents > 0`.
 */
export function validateEventInput(
  raw: unknown,
  now: Date = new Date(),
): EventValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Dados do evento inválidos.' };
  }

  const input = raw as Record<string, unknown>;

  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    return { ok: false, error: 'O nome do evento é obrigatório.' };
  }

  if (typeof input.location !== 'string' || input.location.trim().length === 0) {
    return { ok: false, error: 'O local do evento é obrigatório.' };
  }

  const rawStartsAt = input.startsAt;
  let parsedStartsAt: Date;
  if (rawStartsAt instanceof Date) {
    parsedStartsAt = rawStartsAt;
  } else if (typeof rawStartsAt === 'string' && rawStartsAt.trim().length > 0) {
    parsedStartsAt = new Date(rawStartsAt);
  } else {
    return { ok: false, error: 'A data e hora de início do evento são obrigatórias.' };
  }

  if (Number.isNaN(parsedStartsAt.getTime())) {
    return { ok: false, error: 'Data e hora de início inválidas.' };
  }

  if (parsedStartsAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'A data de início do evento deve estar no futuro.' };
  }

  const rawCapacity = input.capacity;
  if (typeof rawCapacity !== 'number' || !Number.isInteger(rawCapacity) || rawCapacity < 1) {
    return { ok: false, error: 'A lotação máxima deve ser um número inteiro maior ou igual a 1.' };
  }

  const rawPriceCents = input.priceCents;
  if (
    typeof rawPriceCents !== 'number' ||
    !Number.isInteger(rawPriceCents) ||
    rawPriceCents <= 0
  ) {
    return { ok: false, error: 'O preço do ingresso deve ser maior que zero.' };
  }

  return {
    ok: true,
    data: {
      name: input.name.trim(),
      startsAt: parsedStartsAt,
      location: input.location.trim(),
      capacity: rawCapacity,
      priceCents: rawPriceCents,
    },
  };
}

/**
 * Verifies R03/R05 capacity invariant: updated capacity must be at least 1
 * and never less than the number of currently occupied (`pending` + `confirmed`) seats.
 */
export function validateCapacityAgainstOccupied(
  newCapacity: number,
  occupiedSeats: number,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isInteger(newCapacity) || newCapacity < 1) {
    return { ok: false, error: 'A lotação máxima deve ser um número inteiro maior ou igual a 1.' };
  }
  if (!Number.isInteger(occupiedSeats) || occupiedSeats < 0) {
    return { ok: false, error: 'Contagem de vagas ocupadas inválida.' };
  }
  if (newCapacity < occupiedSeats) {
    return {
      ok: false,
      error: `A lotação não pode ser menor que o total de vagas ocupadas (${occupiedSeats}).`,
    };
  }
  return { ok: true };
}

/**
 * Checks strict organizer ownership of an event (R13).
 */
export function isEventOwnedByOrganizer(
  event: { organizerId: string } | null | undefined,
  organizerId: string,
): boolean {
  if (!event || !organizerId) {
    return false;
  }
  return event.organizerId === organizerId;
}

/**
 * Formats an integer amount in cents into Brazilian Real (`R$ X,XX`).
 */
export function formatPriceBrl(priceCents: number): string {
  const safeCents = Number.isFinite(priceCents) ? Math.round(priceCents) : 0;
  const reais = safeCents / 100;
  const formatted = reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted}`;
}

/**
 * Formats cents as an editable Brazilian decimal string (e.g., `10050` -> `"100,50"`).
 */
export function centsToInputBrl(priceCents: number): string {
  const safeCents = Number.isFinite(priceCents) ? Math.round(priceCents) : 0;
  return (safeCents / 100).toFixed(2).replace('.', ',');
}

/**
 * Parses a Brazilian Real currency string (e.g., `"120,50"`, `"120.50"`, `"1.250,00"`, `"R$ 80,00"`)
 * into a positive integer number of cents, or returns `null` if invalid.
 */
export function parseBrlToCents(raw: string): number | null {
  const cleaned = raw.replace(/R\$/gi, '').replace(/\s+/g, '').trim();
  if (cleaned.length === 0) {
    return null;
  }

  let normalized: string;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  } else {
    normalized = cleaned;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const cents = Math.round(parsed * 100);
  return cents > 0 ? cents : null;
}

/**
 * Formats an ISO-8601 date string into a human-readable Brazilian date/time string.
 */
export function formatEventDateBr(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Converts an ISO-8601 date string into a `YYYY-MM-DDTHH:mm` value suitable for `<input type="datetime-local">`.
 */
export function toDateTimeLocalValue(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Returns the localized Portuguese label and Tailwind badge classes for an event status.
 */
export function getEventStatusMeta(status: EventStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'published':
      return {
        label: 'Publicado',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        className: 'bg-red-100 text-red-800 border-red-200',
      };
    case 'draft':
    default:
      return {
        label: 'Rascunho',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
  }
}
