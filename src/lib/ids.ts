import crypto from 'node:crypto';

const TICKET_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TICKET_CODE_LENGTH = 8;

/**
 * Generates a prefixed cryptographically random identifier (e.g., `usr_...`, `evt_...`, `tkt_...`).
 */
export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Generates an 8-character uppercase unambiguous alphanumeric ticket code
 * (excluding visually ambiguous characters `0`, `1`, `I`, and `O`).
 */
export function generateTicketCode(): string {
  let code = '';
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    const index = crypto.randomInt(0, TICKET_CODE_ALPHABET.length);
    code += TICKET_CODE_ALPHABET[index];
  }
  return code;
}
