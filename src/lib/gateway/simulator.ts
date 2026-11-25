const CARD_NUMBER_REGEX = /^\d{16}$/;

export type SimulatedPaymentOutcome = 'confirmed' | 'declined';

export interface SimulatedPaymentEvaluation {
  outcome: SimulatedPaymentOutcome;
  delayMs: number;
}

interface CardRule {
  outcome: SimulatedPaymentOutcome;
  minDelayMs: number;
  maxDelayMs: number;
}

const FAST_MIN_DELAY_MS = 2000;
const FAST_MAX_DELAY_MS = 5000;
const SLOW_MIN_DELAY_MS = 30000;
const SLOW_MAX_DELAY_MS = 40000;

const CARD_SUFFIX_RULES: Readonly<Record<string, CardRule>> = {
  '0001': {
    outcome: 'confirmed',
    minDelayMs: FAST_MIN_DELAY_MS,
    maxDelayMs: FAST_MAX_DELAY_MS,
  },
  '0002': {
    outcome: 'declined',
    minDelayMs: FAST_MIN_DELAY_MS,
    maxDelayMs: FAST_MAX_DELAY_MS,
  },
  '0003': {
    outcome: 'confirmed',
    minDelayMs: SLOW_MIN_DELAY_MS,
    maxDelayMs: SLOW_MAX_DELAY_MS,
  },
  '0004': {
    outcome: 'declined',
    minDelayMs: SLOW_MIN_DELAY_MS,
    maxDelayMs: SLOW_MAX_DELAY_MS,
  },
};

const DEFAULT_CARD_RULE: CardRule = {
  outcome: 'declined',
  minDelayMs: FAST_MIN_DELAY_MS,
  maxDelayMs: FAST_MAX_DELAY_MS,
};

function resolveDelayScale(delayScale?: number): number {
  const candidate =
    delayScale !== undefined ? delayScale : Number(process.env.GATEWAY_DELAY_SCALE ?? '1');
  if (!Number.isFinite(candidate) || candidate < 0) {
    return 1;
  }
  return candidate;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Validates whether a card number consists of exactly 16 numeric digits (`/^\d{16}$/`).
 */
export function isValidCardNumber(cardNumber: string): boolean {
  return CARD_NUMBER_REGEX.test(cardNumber);
}

/**
 * Evaluates a 16-digit card number against the Catraca simulated payment gateway rules:
 * - Ends with `0001`: `confirmed`, random delay in `[2000, 5000]` ms * scale
 * - Ends with `0002`: `declined`, random delay in `[2000, 5000]` ms * scale
 * - Ends with `0003`: `confirmed`, random delay in `[30000, 40000]` ms * scale
 * - Ends with `0004`: `declined`, random delay in `[30000, 40000]` ms * scale
 * - Any other 16-digit card: `declined`, random delay in `[2000, 5000]` ms * scale
 */
export function evaluateSimulatedCard(
  cardNumber: string,
  delayScale?: number,
): SimulatedPaymentEvaluation {
  if (!isValidCardNumber(cardNumber)) {
    throw new Error('Invalid card number: expected exactly 16 numeric digits.');
  }

  const last4 = cardNumber.slice(-4);
  const rule = CARD_SUFFIX_RULES[last4] ?? DEFAULT_CARD_RULE;
  const scale = resolveDelayScale(delayScale);
  const baseDelayMs = randomIntInclusive(rule.minDelayMs, rule.maxDelayMs);
  const delayMs = Math.round(baseDelayMs * scale);

  return {
    outcome: rule.outcome,
    delayMs,
  };
}
