import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { authenticatePartnerRequest } from '@/lib/partner-auth';
import { listPublishedEventsWithSeats } from '@/lib/tickets/queries';

export const dynamic = 'force-dynamic';

export interface PartnerEventSummary {
  id: string;
  name: string;
  startsAt: string;
  priceCents: number;
  availableSeats: number;
}

/**
 * Lists all published, non-cancelled events available for purchase via the Partner API
 * with exact fixed-contract field projection (R02, R05).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authError = await authenticatePartnerRequest(request);
  if (authError) {
    return authError;
  }

  try {
    const events = await listPublishedEventsWithSeats();
    const payload: PartnerEventSummary[] = events.map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      priceCents: event.priceCents,
      availableSeats: event.availableSeats,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (error: unknown) {
    logger.error('partner_list_events_failed', { error });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
