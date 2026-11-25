import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { SOLD_OUT_LABEL } from '@/lib/tickets/labels';
import { purchaseTicket } from '@/lib/tickets/purchase';

export const dynamic = 'force-dynamic';

interface PurchaseRequestBody {
  eventId?: unknown;
  cardNumber?: unknown;
}

const INVALID_CARD_MESSAGE = 'Número de cartão inválido (deve conter 16 dígitos)';

/**
 * Handles storefront ticket purchases for authenticated users (R06, R07).
 * Delegates atomic seat reservation and BullMQ payment enqueueing to `purchaseTicket`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Autenticação obrigatória' },
      { status: 401 },
    );
  }

  let body: PurchaseRequestBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: 'invalid_request', message: INVALID_CARD_MESSAGE },
        { status: 422 },
      );
    }
    body = parsed as PurchaseRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: INVALID_CARD_MESSAGE },
      { status: 422 },
    );
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const cardNumber = typeof body.cardNumber === 'string' ? body.cardNumber.trim() : '';

  try {
    const result = await purchaseTicket({
      eventId,
      buyerEmail: user.email,
      cardNumber,
      channel: 'web',
      userId: user.id,
    });

    if (!result.ok) {
      if (result.error === 'invalid_request') {
        return NextResponse.json(
          { error: 'invalid_request', message: INVALID_CARD_MESSAGE },
          { status: 422 },
        );
      }
      if (result.error === 'event_not_available') {
        return NextResponse.json(
          { error: 'event_not_available', message: 'Evento indisponível' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: 'sold_out', message: SOLD_OUT_LABEL },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ticketId: result.ticket.ticketId,
        code: result.ticket.code,
        status: result.ticket.status,
      },
      { status: 202 },
    );
  } catch (error) {
    logger.error('storefront_purchase_failed', {
      eventId,
      userId: user.id,
      error,
    });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao processar compra' },
      { status: 500 },
    );
  }
}
