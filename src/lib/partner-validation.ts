import { isValidCardNumber } from '@/lib/gateway/simulator';
import { isValidBuyerEmail } from '@/lib/tickets/purchase';
import type { PublishedEventWithSeats, TicketStatusLookup } from '@/lib/tickets/queries';

export interface PartnerEventResponse {
  id: string;
  name: string;
  startsAt: string;
  priceCents: number;
  availableSeats: number;
}

export interface PartnerPurchaseRequest {
  buyerEmail: string;
  cardNumber: string;
}

export interface PartnerPurchaseResponse {
  ticketId: string;
  code: string;
  status: 'pending';
}

export interface PartnerTicketResponse {
  ticketId: string;
  code: string;
  eventId: string;
  status: TicketStatusLookup['status'];
  checkedIn: boolean;
}

export type PartnerPurchaseBodyValidation =
  | { ok: true; data: PartnerPurchaseRequest }
  | { ok: false; error: 'invalid_request' };

/**
 * Validates the JSON request body of `POST /api/partner/events/{eventId}/purchases`.
 * Requires `buyerEmail` to be a valid email string and `cardNumber` to match `/^\d{16}$/`.
 */
export function validatePartnerPurchaseBody(body: unknown): PartnerPurchaseBodyValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_request' };
  }

  const record = body as Record<string, unknown>;
  const { buyerEmail, cardNumber } = record;

  if (typeof buyerEmail !== 'string' || !isValidBuyerEmail(buyerEmail)) {
    return { ok: false, error: 'invalid_request' };
  }

  if (typeof cardNumber !== 'string' || !isValidCardNumber(cardNumber)) {
    return { ok: false, error: 'invalid_request' };
  }

  return {
    ok: true,
    data: {
      buyerEmail: buyerEmail.trim(),
      cardNumber,
    },
  };
}

/**
 * Serializes a published event into the exact fixed contract shape for `GET /api/partner/events`.
 */
export function serializePartnerEvent(event: PublishedEventWithSeats): PartnerEventResponse {
  return {
    id: event.id,
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    priceCents: event.priceCents,
    availableSeats: event.availableSeats,
  };
}

/**
 * Serializes a ticket lookup record into the exact fixed contract shape for `GET /api/partner/tickets/{ticketId}`.
 */
export function serializePartnerTicket(ticket: TicketStatusLookup): PartnerTicketResponse {
  return {
    ticketId: ticket.ticketId,
    code: ticket.code,
    eventId: ticket.eventId,
    status: ticket.status,
    checkedIn: ticket.checkedIn,
  };
}
