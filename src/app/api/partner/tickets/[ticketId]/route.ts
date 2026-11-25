import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { unauthorizedPartnerResponse, validatePartnerApiKey } from '@/lib/partner-auth';
import { serializePartnerTicket } from '@/lib/partner-validation';
import { getTicketById } from '@/lib/tickets/queries';

export const dynamic = 'force-dynamic';

interface PartnerTicketRouteContext {
  params: Promise<{ ticketId: string }>;
}

/**
 * `GET /api/partner/tickets/{ticketId}`
 * Retrieves ticket status and check-in flag for any ticket (web storefront or partner API).
 */
export async function GET(
  request: Request,
  context: PartnerTicketRouteContext,
): Promise<NextResponse> {
  const authorized = await validatePartnerApiKey(request);
  if (!authorized) {
    return unauthorizedPartnerResponse();
  }

  const { ticketId } = await context.params;

  try {
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: 'ticket_not_found' }, { status: 404 });
    }

    return NextResponse.json(serializePartnerTicket(ticket), { status: 200 });
  } catch (error: unknown) {
    logger.error('partner_get_ticket_failed', { ticketId, error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
