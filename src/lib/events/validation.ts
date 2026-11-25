import type { EventStatus } from '@/db/schema';

export interface ValidatedEventInput {
  name: string;
  startsAt: Date;
  location: string;
  capacity: number;
  priceCents: number;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: 'validation_error'; message: string; field?: string };

export interface OrganizerEventSummary {
  id: string;
  organizerId: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: EventStatus;
  occupiedSeats: number;
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

export type CapacityCheckResult =
  | { ok: true }
  | { ok: false; error: 'capacity_below_occupied'; message: string; occupiedSeats: number };

export type StatusGuardResult =
  | { ok: true }
  | { ok: false; error: 'event_cancelled'; message: string };

/**
 * Validates and normalizes event creation or update payload according to R01:
 * - `name`: non-empty trimmed string
 * - `startsAt`: valid date strictly in the future (`> now`)
 * - `location`: non-empty trimmed string
 * - `capacity`: integer `>= 1`
 * - `priceCents`: integer `> 0`
 */
export function validateEventInput(
  raw: unknown,
  now: Date = new Date(),
): ValidationResult<ValidatedEventInput> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      error: 'validation_error',
      message: 'Dados do evento inválidos.',
    };
  }

  const input = raw as Record<string, unknown>;

  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'name',
      message: 'Informe o nome do evento.',
    };
  }

  if (typeof input.location !== 'string' || input.location.trim().length === 0) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'location',
      message: 'Informe o local do evento.',
    };
  }

  let parsedDate: Date | null = null;
  if (input.startsAt instanceof Date) {
    parsedDate = input.startsAt;
  } else if (typeof input.startsAt === 'string' && input.startsAt.trim().length > 0) {
    parsedDate = new Date(input.startsAt);
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'startsAt',
      message: 'Informe uma data e hora de início válidas.',
    };
  }

  if (parsedDate.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'startsAt',
      message: 'A data e hora de início do evento devem estar no futuro.',
    };
  }

  if (
    typeof input.capacity !== 'number' ||
    !Number.isInteger(input.capacity) ||
    input.capacity < 1
  ) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'capacity',
      message: 'A lotação deve ser um número inteiro maior ou igual a 1.',
    };
  }

  if (
    typeof input.priceCents !== 'number' ||
    !Number.isInteger(input.priceCents) ||
    input.priceCents <= 0
  ) {
    return {
      ok: false,
      error: 'validation_error',
      field: 'priceCents',
      message: 'O preço do ingresso deve ser maior que zero.',
    };
  }

  return {
    ok: true,
    data: {
      name: input.name.trim(),
      startsAt: parsedDate,
      location: input.location.trim(),
      capacity: input.capacity,
      priceCents: input.priceCents,
    },
  };
}

/**
 * Checks whether a new event capacity satisfies R03 and R05 (`newCapacity >= occupiedSeats`).
 */
export function validateCapacityChange(
  newCapacity: number,
  occupiedSeats: number,
): CapacityCheckResult {
  if (newCapacity < occupiedSeats) {
    return {
      ok: false,
      error: 'capacity_below_occupied',
      occupiedSeats,
      message: `A lotação não pode ser menor que o total de vagas ocupadas (${occupiedSeats}).`,
    };
  }
  return { ok: true };
}

/**
 * Checks whether an organizer owns the given event record (R13).
 */
export function isEventOwner(eventOrganizerId: string, requesterOrganizerId: string): boolean {
  return eventOrganizerId === requesterOrganizerId;
}

/**
 * Guards against editing or publishing a cancelled event (R11).
 */
export function ensureEventNotCancelled(
  status: EventStatus,
  action: 'edit' | 'publish',
): StatusGuardResult {
  if (status === 'cancelled') {
    return {
      ok: false,
      error: 'event_cancelled',
      message:
        action === 'publish'
          ? 'Eventos cancelados não podem ser publicados.'
          : 'Eventos cancelados não podem ser editados.',
    };
  }
  return { ok: true };
}

/**
 * Computes available seats following R05/R12:
 * cancelled events always report `0`; otherwise `Math.max(0, capacity - occupiedSeats)`.
 */
export function calculateAvailableSeats(
  status: EventStatus,
  capacity: number,
  occupiedSeats: number,
): number {
  if (status === 'cancelled') {
    return 0;
  }
  return Math.max(0, capacity - occupiedSeats);
}

/**
 * Formats an integer amount in cents as Brazilian Real currency (`R$ 100,00`).
 */
export function formatPriceCentsToBRL(priceCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(priceCents / 100);
}

/**
 * Parses a BRL decimal string (e.g., `"100,00"`, `"100.50"`, `"45"`) into integer cents,
 * or returns `null` if invalid or non-positive.
 */
export function parseBRLToCents(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const cents = Math.round(value * 100);
  return cents > 0 ? cents : null;
}
