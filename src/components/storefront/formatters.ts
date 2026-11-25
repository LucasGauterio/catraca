import type { TicketStatus } from '@/db/schema';
import type { PurchaseErrorCode } from '@/lib/tickets/purchase';

/**
 * Exact Portuguese status labels required for participant ticket display (R09).
 */
export const TICKET_STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado',
};

/**
 * Returns the exact Brazilian Portuguese status label for a ticket status (R09).
 */
export function getTicketStatusLabel(status: TicketStatus): string {
  return TICKET_STATUS_LABELS[status];
}

/**
 * Formats an integer amount in cents into Brazilian Real currency (e.g. `10000` -> `R$ 100,00`).
 */
export function formatPriceBrl(priceCents: number): string {
  const safeCents = Number.isFinite(priceCents) ? Math.round(priceCents) : 0;
  const negative = safeCents < 0;
  const absCents = Math.abs(safeCents);
  const reais = Math.floor(absCents / 100);
  const cents = String(absCents % 100).padStart(2, '0');
  const reaisFormatted = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${reaisFormatted},${cents}`;
}

/**
 * Formats an ISO string or Date into a readable Brazilian date/time string.
 */
export function formatEventDateTime(dateInput: Date | string): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export interface PurchaseHttpErrorResponse {
  status: 404 | 409 | 422;
  body: {
    error: PurchaseErrorCode;
    message: string;
  };
}

/**
 * Maps domain purchase errors to HTTP status codes and payloads for `POST /api/purchases` (R07).
 */
export function mapPurchaseErrorToHttp(
  error: PurchaseErrorCode,
  message: string,
): PurchaseHttpErrorResponse {
  switch (error) {
    case 'invalid_request':
      return {
        status: 422,
        body: {
          error: 'invalid_request',
          message,
        },
      };
    case 'event_not_available':
      return {
        status: 404,
        body: {
          error: 'event_not_available',
          message,
        },
      };
    case 'sold_out':
      return {
        status: 409,
        body: {
          error: 'sold_out',
          message: 'Ingressos esgotados',
        },
      };
  }
}
