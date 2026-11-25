import { NextResponse } from 'next/server';
import { mapPurchaseErrorToHttp } from '@/components/storefront/formatters';
import { AuthError, requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { purchaseTicket } from '@/lib/tickets/purchase';

export const dynamic = 'force-dynamic';

/**
 * Reserves a ticket for an authenticated user through the public storefront channel (R06, R07).
 * Delegates concurrency control (`SELECT ... FOR UPDATE`) and async payment enqueuing to `purchaseTicket`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Corpo JSON inválido.' },
        { status: 422 },
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Informe eventId e cardNumber válidos.' },
        { status: 422 },
      );
    }

    const record = body as Record<string, unknown>;
    const eventId = typeof record.eventId === 'string' ? record.eventId : '';
    const cardNumber = typeof record.cardNumber === 'string' ? record.cardNumber : '';

    const result = await purchaseTicket({
      eventId,
      buyerEmail: user.email,
      cardNumber,
      channel: 'web',
      userId: user.id,
    });

    if (!result.ok) {
      const mapped = mapPurchaseErrorToHttp(result.error, result.message);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    return NextResponse.json(
      {
        ticketId: result.ticket.ticketId,
        code: result.ticket.code,
        status: result.ticket.status,
      },
      { status: 202 },
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.statusCode },
      );
    }
    logger.error('participant_purchase_failed', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao processar compra de ingresso.' },
      { status: 500 },
    );
  }
}
