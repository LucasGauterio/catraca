import { describe, expect, it } from 'vitest';
import {
  checkRoleAccess,
  hashApiKey,
  hashPassword,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
  type AuthenticatedUser,
} from '@/lib/auth-utils';
import { generateId, generateTicketCode } from '@/lib/ids';
import { formatLogEntry, LGPD_REDACTED, redactLogData } from '@/lib/logger';

describe('F01 — LGPD Logger Redaction', () => {
  it('redacts sensitive top-level and nested fields with [LGPD_REDACTED] without plaintext leaks', () => {
    const rawPayload = {
      eventId: 'evt_123',
      password: 'SuperSecretPassword!123',
      cardNumber: '4111111111110001',
      email: 'participante@catraca.local',
      buyerEmail: 'comprador@parceiro.local',
      apiKey: 'catraca-partner-key-2026',
      token: 'sess_secret_token_999',
      nested: {
        passwordHash: 'salt:deadbeef',
        authorization: 'Bearer top-secret',
        safeField: 'visible-value',
      },
      items: [{ email: 'nested@catraca.local', card_number: '5555444433330002' }],
    };

    const jsonLine = formatLogEntry('info', 'purchase_attempted', rawPayload);
    const parsed = JSON.parse(jsonLine) as {
      level: string;
      message: string;
      meta: Record<string, unknown>;
    };

    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('purchase_attempted');
    expect(parsed.meta.eventId).toBe('evt_123');
    expect(parsed.meta.password).toBe(LGPD_REDACTED);
    expect(parsed.meta.cardNumber).toBe(LGPD_REDACTED);
    expect(parsed.meta.email).toBe(LGPD_REDACTED);
    expect(parsed.meta.buyerEmail).toBe(LGPD_REDACTED);
    expect(parsed.meta.apiKey).toBe(LGPD_REDACTED);
    expect(parsed.meta.token).toBe(LGPD_REDACTED);

    const nested = parsed.meta.nested as Record<string, unknown>;
    expect(nested.passwordHash).toBe(LGPD_REDACTED);
    expect(nested.authorization).toBe(LGPD_REDACTED);
    expect(nested.safeField).toBe('visible-value');

    const items = parsed.meta.items as Array<Record<string, unknown>>;
    expect(items[0]?.email).toBe(LGPD_REDACTED);
    expect(items[0]?.card_number).toBe(LGPD_REDACTED);

    expect(jsonLine).not.toContain('SuperSecretPassword!123');
    expect(jsonLine).not.toContain('4111111111110001');
    expect(jsonLine).not.toContain('participante@catraca.local');
    expect(jsonLine).not.toContain('comprador@parceiro.local');
    expect(jsonLine).not.toContain('catraca-partner-key-2026');
    expect(jsonLine).not.toContain('sess_secret_token_999');
    expect(jsonLine).not.toContain('5555444433330002');
  });

  it('handles circular references safely during redaction', () => {
    const circular: Record<string, unknown> = { email: 'user@example.com' };
    circular.self = circular;

    const redacted = redactLogData(circular) as Record<string, unknown>;
    expect(redacted.email).toBe(LGPD_REDACTED);
    expect(redacted.self).toBe('[CIRCULAR]');
  });
});

describe('F01 — Password Hashing & API Key Digest', () => {
  it('hashes and verifies passwords with unique random salts', async () => {
    const hash1 = await hashPassword('SenhaOrgA!123');
    const hash2 = await hashPassword('SenhaOrgA!123');

    expect(hash1).not.toBe(hash2);
    expect(hash1.includes(':')).toBe(true);
    expect(await verifyPassword('SenhaOrgA!123', hash1)).toBe(true);
    expect(await verifyPassword('SenhaOrgA!123', hash2)).toBe(true);
    expect(await verifyPassword('SenhaErrada!123', hash1)).toBe(false);
    expect(await verifyPassword('SenhaOrgA!123', 'malformed-hash')).toBe(false);
  });

  it('computes deterministic SHA-256 hex digest for Partner API keys', () => {
    const digest1 = hashApiKey('catraca-partner-key-2026');
    const digest2 = hashApiKey('catraca-partner-key-2026');

    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('F01 — ID & Ticket Code Generators', () => {
  it('generates prefixed identifiers with cryptographically random suffixes', () => {
    const usrId = generateId('usr');
    const evtId = generateId('evt');
    const tktId = generateId('tkt');

    expect(usrId).toMatch(/^usr_[a-f0-9]{24}$/);
    expect(evtId).toMatch(/^evt_[a-f0-9]{24}$/);
    expect(tktId).toMatch(/^tkt_[a-f0-9]{24}$/);
    expect(generateId('tkt')).not.toBe(tktId);
  });

  it('generates unique 8-character uppercase unambiguous ticket codes', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const code = generateTicketCode();
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);
      expect(code).not.toMatch(/[01IO]/);
      seen.add(code);
    }
    expect(seen.size).toBe(500);
  });
});

describe('F01 — RBAC Guards (R13) & Auth Input Validation', () => {
  const organizerUser: AuthenticatedUser = {
    id: 'usr_organizer_a',
    name: 'Organizador A',
    email: 'organizador.a@catraca.local',
    role: 'organizer',
  };

  const participantUser: AuthenticatedUser = {
    id: 'usr_participant_seed',
    name: 'Participante Catraca',
    email: 'participante@catraca.local',
    role: 'participant',
  };

  it('enforces organizer-only and participant-only access guards', () => {
    const unauth = checkRoleAccess(null, 'organizer');
    expect(unauth.allowed).toBe(false);
    if (!unauth.allowed) {
      expect(unauth.statusCode).toBe(401);
    }

    const participantOnOrganizer = checkRoleAccess(participantUser, 'organizer');
    expect(participantOnOrganizer.allowed).toBe(false);
    if (!participantOnOrganizer.allowed) {
      expect(participantOnOrganizer.statusCode).toBe(403);
    }

    const organizerOnOrganizer = checkRoleAccess(organizerUser, 'organizer');
    expect(organizerOnOrganizer.allowed).toBe(true);

    const organizerOnParticipant = checkRoleAccess(organizerUser, 'participant');
    expect(organizerOnParticipant.allowed).toBe(false);
    if (!organizerOnParticipant.allowed) {
      expect(organizerOnParticipant.statusCode).toBe(403);
    }

    const participantOnParticipant = checkRoleAccess(participantUser, 'participant');
    expect(participantOnParticipant.allowed).toBe(true);
  });

  it('validates and normalizes registration and login inputs', () => {
    const validReg = validateRegistrationInput({
      name: '  Maria Silva  ',
      email: '  MARIA@Exemplo.COM ',
      password: 'SenhaSegura!1',
    });
    expect(validReg.ok).toBe(true);
    if (validReg.ok) {
      expect(validReg.data.name).toBe('Maria Silva');
      expect(validReg.data.email).toBe('maria@exemplo.com');
    }

    const invalidReg = validateRegistrationInput({
      name: 'A',
      email: 'not-an-email',
      password: '123',
    });
    expect(invalidReg.ok).toBe(false);

    const validLogin = validateLoginInput({
      email: ' Organizador.A@Catraca.Local ',
      password: 'SenhaOrgA!123',
    });
    expect(validLogin.ok).toBe(true);
    if (validLogin.ok) {
      expect(validLogin.data.email).toBe('organizador.a@catraca.local');
    }
  });
});
