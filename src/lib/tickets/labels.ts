import type { EventStatus, TicketStatus } from '@/db/schema';

/**
 * Exact PT-BR label displayed when an event has no seats left (R07).
 */
export const SOLD_OUT_LABEL = 'Ingressos esgotados' as const;

/**
 * Exact PT-BR labels for every ticket status required by the Catraca specification (R09).
 */
export const TICKET_STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
};

/**
 * Returns the exact PT-BR display label for a ticket status (R09).
 */
export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABELS[status];
}

/**
 * Formats an integer amount in cents into Brazilian Real currency using a standard space
 * (`R$ 100,00`, `R$ 350,00`, `R$ 0,00`) for reliable UI display and text matching.
 */
export function formatBrlFromCents(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const sign = safeCents < 0 ? '-' : '';
  const absCents = Math.abs(safeCents);
  const reais = Math.floor(absCents / 100);
  const centavos = String(absCents % 100).padStart(2, '0');
  const reaisFormatted = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${reaisFormatted},${centavos}`;
}

/**
 * Returns `true` when an event has zero (or fewer) seats available and must display
 * the sold-out state (`Ingressos esgotados`, R07).
 */
export function isEventSoldOut(availableSeats: number): boolean {
  return availableSeats <= 0;
}

/**
 * Returns `true` only when an event is eligible to appear on the public storefront (R02).
 */
export function isEventVisibleOnStorefront(status: EventStatus): boolean {
  return status === 'published';
}

/**
 * Formats an event start date/time in Brazilian Portuguese (`dd/mm/aaaa, hh:mm`).
 */
export function formatEventDateTimePtBr(startsAt: Date | string): string {
  const date = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}
