import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { unauthorizedPartnerResponse, validatePartnerApiKey } from '@/lib/partner-auth';
import {
  validatePartnerPurchaseBody,
  type PartnerPurchaseResponse,
} from '@/lib/partner-validation';
import { purchaseTicket } from '@/lib/tickets/purchase';

export const dynamic = 'force-dynamic';

interface PartnerPurchaseRouteContext {
  params: Promise<{ eventId: string }>;
}

/**
 * `POST /api/partner/events/{eventId}/purchases`
 * Creates a pending ticket reservation via the Partner API following the strict
 * validation order: `401 unauthorized` -> `422 invalid_request` -> `404 event_not_available`
 * -> `409 sold_out` -> `202 pending`.
 */
export async function POST(
  request: Request,
  context: PartnerPurchaseRouteContext,
): Promise<NextResponse> {
  const authorized = await validatePartnerApiKey(request);
  if (!authorized) {
    return unauthorizedPartnerResponse();
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 422 });
  }

  const validation = validatePartnerPurchaseBody(parsedBody);
  if (!validation.ok) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 422 });
  }

  const { eventId } = await context.params;

  try {
    const result = await purchaseTicket({
      eventId,
      buyerEmail: validation.data.buyerEmail,
      cardNumber: validation.data.cardNumber,
      channel: 'partner',
      userId: null,
    });

    if (!result.ok) {
      if (result.error === 'invalid_request') {
        return NextResponse.json({ error: 'invalid_request' }, { status: 422 });
      }
      if (result.error === 'event_not_available') {
        return NextResponse.json({ error: 'event_not_available' }, { status: 404 });
      }
      return NextResponse.json({ error: 'sold_out' }, { status: 409 });
    }

    const responseBody: PartnerPurchaseResponse = {
      ticketId: result.ticket.ticketId,
      code: result.ticket.code,
      status: result.ticket.status,
    };

    return NextResponse.json(responseBody, { status: 202 });
  } catch (error: unknown) {
    logger.error('partner_purchase_failed', { eventId, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
