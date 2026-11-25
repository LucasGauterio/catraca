import crypto from 'node:crypto';

export type GatewayOutcome = 'confirmed' | 'declined';

export interface GatewayDecision {
  outcome: GatewayOutcome;
  delayMs: number;
}

const CARD_NUMBER_REGEX = /^\d{16}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

interface GatewayRule {
  outcome: GatewayOutcome;
  minMs: number;
  maxMs: number;
}

const FAST_DELAY_MIN_MS = 2000;
const FAST_DELAY_MAX_MS = 5000;
const SLOW_DELAY_MIN_MS = 30000;
const SLOW_DELAY_MAX_MS = 40000;

const GATEWAY_RULES: Record<string, GatewayRule> = {
  '0001': { outcome: 'confirmed', minMs: FAST_DELAY_MIN_MS, maxMs: FAST_DELAY_MAX_MS },
  '0002': { outcome: 'declined', minMs: FAST_DELAY_MIN_MS, maxMs: FAST_DELAY_MAX_MS },
  '0003': { outcome: 'confirmed', minMs: SLOW_DELAY_MIN_MS, maxMs: SLOW_DELAY_MAX_MS },
  '0004': { outcome: 'declined', minMs: SLOW_DELAY_MIN_MS, maxMs: SLOW_DELAY_MAX_MS },
};

const DEFAULT_GATEWAY_RULE: GatewayRule = {
  outcome: 'declined',
  minMs: FAST_DELAY_MIN_MS,
  maxMs: FAST_DELAY_MAX_MS,
};

function randomIntInclusive(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

/**
 * Resolves the effective gateway delay multiplier from an optional override or
 * the `GATEWAY_DELAY_SCALE` environment variable (defaulting to `1`).
 */
export function getGatewayDelayScale(overrideScale?: number): number {
  if (overrideScale !== undefined) {
    return Number.isFinite(overrideScale) && overrideScale >= 0 ? overrideScale : 1;
  }

  const rawEnv = process.env.GATEWAY_DELAY_SCALE;
  if (rawEnv === undefined || rawEnv.trim() === '') {
    return 1;
  }

  const parsed = Number(rawEnv);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/**
 * Validates that a credit card number contains strictly 16 numeric digits (`/^\d{16}$/`).
 */
export function validateCardNumber(cardNumber: string): boolean {
  return typeof cardNumber === 'string' && CARD_NUMBER_REGEX.test(cardNumber);
}

/**
 * Validates that an email address conforms to a strict basic email format.
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  const trimmed = email.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(trimmed);
}

/**
 * Determines the simulated payment gateway outcome and processing delay (in milliseconds)
 * based on the last 4 digits of the card number per R08 / brief.md:
 * - `0001`: confirmed, 2000-5000 ms
 * - `0002`: declined, 2000-5000 ms
 * - `0003`: confirmed, 30000-40000 ms
 * - `0004`: declined, 30000-40000 ms
 * - any other ending: declined, 2000-5000 ms
 */
export function resolveGatewayDecision(
  cardLast4: string,
  delayScale?: number,
): GatewayDecision {
  const rule = GATEWAY_RULES[cardLast4] ?? DEFAULT_GATEWAY_RULE;
  const baseDelayMs = randomIntInclusive(rule.minMs, rule.maxMs);
  const scale = getGatewayDelayScale(delayScale);
  const delayMs = Math.max(0, Math.round(baseDelayMs * scale));

  return {
    outcome: rule.outcome,
    delayMs,
  };
}
