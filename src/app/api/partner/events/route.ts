import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { unauthorizedPartnerResponse, validatePartnerApiKey } from '@/lib/partner-auth';
import { serializePartnerEvent } from '@/lib/partner-validation';
import { listPublishedEventsWithSeats } from '@/lib/tickets/queries';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/partner/events`
 * Lists all published (non-cancelled) events available for purchase with exact Partner API fields.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authorized = await validatePartnerApiKey(request);
  if (!authorized) {
    return unauthorizedPartnerResponse();
  }

  try {
    const events = await listPublishedEventsWithSeats();
    const payload = events.map(serializePartnerEvent);
    return NextResponse.json(payload, { status: 200 });
  } catch (error: unknown) {
    logger.error('partner_list_events_failed', { error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
