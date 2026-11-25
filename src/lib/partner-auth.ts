import { NextResponse } from 'next/server';
import { verifyPartnerApiKey } from '@/lib/auth';
import { logger } from '@/lib/logger';

export interface PartnerErrorResponse {
  error: string;
}

/**
 * Extracts and trims the `X-Api-Key` header from an incoming HTTP request.
 * Returns `null` when the header is missing or blank.
 */
export function extractPartnerApiKey(request: Request): string | null {
  const rawKey = request.headers.get('x-api-key');
  if (!rawKey) {
    return null;
  }
  const trimmed = rawKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validates the `X-Api-Key` header against active partner API keys stored as SHA-256
 * hex digests in the `api_keys` table.
 */
export async function validatePartnerApiKey(request: Request): Promise<boolean> {
  const rawKey = extractPartnerApiKey(request);
  if (!rawKey) {
    logger.warn('partner_api_unauthorized', { reason: 'missing_api_key' });
    return false;
  }

  const isValid = await verifyPartnerApiKey(rawKey);
  if (!isValid) {
    logger.warn('partner_api_unauthorized', { reason: 'invalid_api_key' });
    return false;
  }

  return true;
}

/**
 * Returns the fixed Partner API `401 Unauthorized` JSON response (`{"error":"unauthorized"}`).
 */
export function unauthorizedPartnerResponse(): NextResponse<PartnerErrorResponse> {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

/**
 * Authenticates an incoming Partner API request using the `X-Api-Key` header.
 * Returns a `401 {"error":"unauthorized"}` `NextResponse` when the header is missing
 * or invalid, or `null` when the request is authorized.
 */
export async function authenticatePartnerRequest(
  request: Request,
): Promise<NextResponse<PartnerErrorResponse> | null> {
  const isValid = await validatePartnerApiKey(request);
  return isValid ? null : unauthorizedPartnerResponse();
}
