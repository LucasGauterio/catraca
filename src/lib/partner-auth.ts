import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { hashApiKey } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';

export interface PartnerErrorBody {
  error: string;
}

/**
 * Extracts and trims the `X-Api-Key` header from an incoming HTTP request.
 * Returns `null` when the header is missing or blank.
 */
export function extractPartnerApiKey(request: Request): string | null {
  const headerValue = request.headers.get('x-api-key');
  if (headerValue === null) {
    return null;
  }
  const trimmed = headerValue.trim();
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

  const keyHash = hashApiKey(rawKey);
  const rows = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);

  if (rows.length === 0) {
    logger.warn('partner_api_unauthorized', { reason: 'invalid_api_key' });
    return false;
  }

  return true;
}

/**
 * Returns the fixed Partner API `401 Unauthorized` JSON response (`{"error":"unauthorized"}`).
 */
export function unauthorizedPartnerResponse(): NextResponse<PartnerErrorBody> {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
