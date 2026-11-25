import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { events, tickets, type Event, type EventStatus } from '@/db/schema';
import { generateId } from '@/lib/ids';
import { logger } from '@/lib/logger';

export type EventServiceErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'event_cancelled'
  | 'capacity_below_occupied';

/**
 * Domain error thrown by event management operations with an explicit HTTP status code.
 */
export class EventServiceError extends Error {
  public readonly statusCode: 400 | 404 | 409 | 422;
  public readonly code: EventServiceErrorCode;

  constructor(
    statusCode: 400 | 404 | 409 | 422,
    code: EventServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EventServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

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

interface LockedEventRow {
  id: string;
  organizer_id: string;
  name: string;
  starts_at: Date | string;
  location: string;
  capacity: number;
  price_cents: number;
  status: EventStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OccupiedCountRow {
  occupied: number | string;
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
 * Converts a Drizzle `Event` record into a JSON-safe `SerializedEvent`.
 */
export function serializeEvent(row: Event): SerializedEvent {
  return {
    id: row.id,
    organizerId: row.organizerId,
    name: row.name,
    startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : String(row.startsAt),
    location: row.location,
    capacity: row.capacity,
    priceCents: row.priceCents,
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function toAvailableSeats(status: EventStatus, capacity: number, occupiedSeats: number): number {
  if (status === 'cancelled') {
    return 0;
  }
  return Math.max(0, capacity - occupiedSeats);
}

/**
 * Creates a new event owned by `organizerId` with initial status `'draft'` (R01, R02).
 */
export async function createEvent(
  organizerId: string,
  input: unknown,
): Promise<OrganizerEventWithOccupancy> {
  const parsed = validateEventInput(input);
  if (!parsed.ok) {
    throw new EventServiceError(422, 'invalid_input', parsed.error);
  }

  const now = new Date();
  const id = generateId('evt');

  const inserted = await db
    .insert(events)
    .values({
      id,
      organizerId,
      name: parsed.data.name,
      startsAt: parsed.data.startsAt,
      location: parsed.data.location,
      capacity: parsed.data.capacity,
      priceCents: parsed.data.priceCents,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const created = inserted[0];
  if (!created) {
    throw new Error('Falha ao persistir evento.');
  }

  logger.info('event_created', {
    eventId: created.id,
    organizerId,
    status: created.status,
    capacity: created.capacity,
    priceCents: created.priceCents,
  });

  return {
    ...serializeEvent(created),
    occupiedSeats: 0,
    availableSeats: created.capacity,
  };
}

/**
 * Lists all events owned exclusively by `organizerId` (R13), ordered newest first.
 */
export async function listOrganizerEvents(
  organizerId: string,
): Promise<OrganizerEventWithOccupancy[]> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.organizerId, organizerId))
    .orderBy(desc(events.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const eventIds = rows.map((row) => row.id);
  const occupancyRows = await db
    .select({
      eventId: tickets.eventId,
      occupied: sql<number>`COUNT(*)::int`,
    })
    .from(tickets)
    .where(and(inArray(tickets.eventId, eventIds), inArray(tickets.status, ['pending', 'confirmed'])))
    .groupBy(tickets.eventId);

  const occupancyMap = new Map<string, number>();
  for (const occ of occupancyRows) {
    occupancyMap.set(occ.eventId, Number(occ.occupied) || 0);
  }

  return rows.map((row) => {
    const occupiedSeats = occupancyMap.get(row.id) ?? 0;
    return {
      ...serializeEvent(row),
      occupiedSeats,
      availableSeats: toAvailableSeats(row.status, row.capacity, occupiedSeats),
    };
  });
}

/**
 * Fetches a single event by ID ONLY if it belongs to `organizerId`; returns `null` otherwise (R13).
 */
export async function getOrganizerEventById(
  organizerId: string,
  eventId: string,
): Promise<OrganizerEventWithOccupancy | null> {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
    .limit(1);

  const eventRow = rows[0];
  if (!eventRow) {
    return null;
  }

  const occupancyRows = await db
    .select({
      occupied: sql<number>`COUNT(*)::int`,
    })
    .from(tickets)
    .where(and(eq(tickets.eventId, eventRow.id), inArray(tickets.status, ['pending', 'confirmed'])));

  const occupiedSeats = Number(occupancyRows[0]?.occupied ?? 0);

  return {
    ...serializeEvent(eventRow),
    occupiedSeats,
    availableSeats: toAvailableSeats(eventRow.status, eventRow.capacity, occupiedSeats),
  };
}

/**
 * Updates an organizer's event inside a transactional `SELECT ... FOR UPDATE` lock.
 * Enforces R01 (future start date), R03/R05 (capacity >= occupied seats, price change only affects
 * future purchases), R11 (cancelled events cannot be edited), and R13 (strict ownership).
 */
export async function updateOrganizerEvent(
  organizerId: string,
  eventId: string,
  input: unknown,
): Promise<OrganizerEventWithOccupancy> {
  const parsed = validateEventInput(input);
  if (!parsed.ok) {
    throw new EventServiceError(422, 'invalid_input', parsed.error);
  }

  return db.transaction(async (tx) => {
    const lockedResult = await tx.execute(
      sql`SELECT id, organizer_id, name, starts_at, location, capacity, price_cents, status, created_at, updated_at FROM events WHERE id = ${eventId} FOR UPDATE`,
    );

    const lockedRow = lockedResult.rows[0] as unknown as LockedEventRow | undefined;
    if (!lockedRow || !isEventOwnedByOrganizer({ organizerId: lockedRow.organizer_id }, organizerId)) {
      throw new EventServiceError(404, 'not_found', 'Evento não encontrado.');
    }

    if (lockedRow.status === 'cancelled') {
      throw new EventServiceError(
        409,
        'event_cancelled',
        'Eventos cancelados não podem ser editados.',
      );
    }

    const countResult = await tx.execute(
      sql`SELECT COUNT(*)::int AS occupied FROM tickets WHERE event_id = ${eventId} AND status IN ('pending', 'confirmed')`,
    );
    const countRow = countResult.rows[0] as unknown as OccupiedCountRow | undefined;
    const occupiedSeats = Number(countRow?.occupied ?? 0);

    const capacityCheck = validateCapacityAgainstOccupied(parsed.data.capacity, occupiedSeats);
    if (!capacityCheck.ok) {
      throw new EventServiceError(409, 'capacity_below_occupied', capacityCheck.error);
    }

    const updatedRows = await tx
      .update(events)
      .set({
        name: parsed.data.name,
        startsAt: parsed.data.startsAt,
        location: parsed.data.location,
        capacity: parsed.data.capacity,
        priceCents: parsed.data.priceCents,
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new EventServiceError(404, 'not_found', 'Evento não encontrado.');
    }

    logger.info('event_updated', {
      eventId: updated.id,
      organizerId,
      capacity: updated.capacity,
      priceCents: updated.priceCents,
      occupiedSeats,
    });

    return {
      ...serializeEvent(updated),
      occupiedSeats,
      availableSeats: toAvailableSeats(updated.status, updated.capacity, occupiedSeats),
    };
  });
}

/**
 * Publishes an organizer's draft event (`draft -> published`, R02).
 * Rejects non-owners (R13) and cancelled events (R11).
 */
export async function publishOrganizerEvent(
  organizerId: string,
  eventId: string,
): Promise<OrganizerEventWithOccupancy> {
  return db.transaction(async (tx) => {
    const lockedResult = await tx.execute(
      sql`SELECT id, organizer_id, name, starts_at, location, capacity, price_cents, status, created_at, updated_at FROM events WHERE id = ${eventId} FOR UPDATE`,
    );

    const lockedRow = lockedResult.rows[0] as unknown as LockedEventRow | undefined;
    if (!lockedRow || !isEventOwnedByOrganizer({ organizerId: lockedRow.organizer_id }, organizerId)) {
      throw new EventServiceError(404, 'not_found', 'Evento não encontrado.');
    }

    if (lockedRow.status === 'cancelled') {
      throw new EventServiceError(
        409,
        'event_cancelled',
        'Eventos cancelados não podem ser publicados.',
      );
    }

    const countResult = await tx.execute(
      sql`SELECT COUNT(*)::int AS occupied FROM tickets WHERE event_id = ${eventId} AND status IN ('pending', 'confirmed')`,
    );
    const countRow = countResult.rows[0] as unknown as OccupiedCountRow | undefined;
    const occupiedSeats = Number(countRow?.occupied ?? 0);

    if (lockedRow.status === 'published') {
      const existingSerialized: SerializedEvent = {
        id: lockedRow.id,
        organizerId: lockedRow.organizer_id,
        name: lockedRow.name,
        startsAt:
          lockedRow.starts_at instanceof Date
            ? lockedRow.starts_at.toISOString()
            : new Date(lockedRow.starts_at).toISOString(),
        location: lockedRow.location,
        capacity: Number(lockedRow.capacity),
        priceCents: Number(lockedRow.price_cents),
        status: lockedRow.status,
        createdAt:
          lockedRow.created_at instanceof Date
            ? lockedRow.created_at.toISOString()
            : new Date(lockedRow.created_at).toISOString(),
        updatedAt:
          lockedRow.updated_at instanceof Date
            ? lockedRow.updated_at.toISOString()
            : new Date(lockedRow.updated_at).toISOString(),
      };

      return {
        ...existingSerialized,
        occupiedSeats,
        availableSeats: toAvailableSeats(
          existingSerialized.status,
          existingSerialized.capacity,
          occupiedSeats,
        ),
      };
    }

    const updatedRows = await tx
      .update(events)
      .set({
        status: 'published',
        updatedAt: new Date(),
      })
      .where(and(eq(events.id, eventId), eq(events.organizerId, organizerId)))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new EventServiceError(404, 'not_found', 'Evento não encontrado.');
    }

    logger.info('event_published', {
      eventId: updated.id,
      organizerId,
      status: updated.status,
    });

    return {
      ...serializeEvent(updated),
      occupiedSeats,
      availableSeats: toAvailableSeats(updated.status, updated.capacity, occupiedSeats),
    };
  });
}
