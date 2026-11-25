import { NextResponse } from 'next/server';
import { verifyPartnerApiKey } from '@/lib/auth';
import { logger } from '@/lib/logger';

export interface PartnerErrorResponse {
  error: string;
}

/**
 * Authenticates an incoming Partner API request using the `X-Api-Key` header.
 * Returns a `401 {"error":"unauthorized"}` `NextResponse` when the header is missing
 * or invalid, or `null` when the request is authorized.
 */
export async function authenticatePartnerRequest(
  request: Request,
): Promise<NextResponse<PartnerErrorResponse> | null> {
  const rawKey = request.headers.get('x-api-key');

  if (!rawKey || rawKey.trim().length === 0) {
    logger.warn('partner_api_unauthorized', { reason: 'missing_api_key' });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const isValid = await verifyPartnerApiKey(rawKey);
  if (!isValid) {
    logger.warn('partner_api_unauthorized', { reason: 'invalid_api_key' });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return null;
}
