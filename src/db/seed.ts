import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './index';
import { runMigrations } from './migrate';
import { hashApiKey, hashPassword } from '../lib/auth-utils';
import { logger } from '../lib/logger';
import type { UserRole } from './schema';

interface SeedUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const SEED_USERS: readonly SeedUser[] = [
  {
    id: 'usr_organizer_a',
    name: 'Organizador A',
    email: 'organizador.a@catraca.local',
    password: 'SenhaOrgA!123',
    role: 'organizer',
  },
  {
    id: 'usr_organizer_b',
    name: 'Organizador B',
    email: 'organizador.b@catraca.local',
    password: 'SenhaOrgB!123',
    role: 'organizer',
  },
  {
    id: 'usr_participant_seed',
    name: 'Participante Catraca',
    email: 'participante@catraca.local',
    password: 'SenhaPart!123',
    role: 'participant',
  },
];

const DEFAULT_PARTNER_API_KEY = 'catraca-partner-key-2026';

/**
 * Runs idempotent database seed for Organizador A, Organizador B, Participante seed,
 * and the Partner API key (`catraca-partner-key-2026`).
 */
export async function runSeed(): Promise<void> {
  await runMigrations();
  const pool = getPool();

  for (const seedUser of SEED_USERS) {
    const passwordHash = await hashPassword(seedUser.password);
    await pool.query(
      `
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role
      `,
      [seedUser.id, seedUser.name, seedUser.email, passwordHash, seedUser.role],
    );
  }

  const rawPartnerKey = process.env.PARTNER_API_KEY ?? DEFAULT_PARTNER_API_KEY;
  const keyHash = hashApiKey(rawPartnerKey);

  await pool.query(
    `
    INSERT INTO api_keys (id, name, key_hash, active)
    VALUES ($1, $2, $3, TRUE)
    ON CONFLICT (key_hash) DO NOTHING
    `,
    ['key_partner_default', 'Parceiro Padrão Catraca', keyHash],
  );

  logger.info('db_seed_completed', {
    usersCount: SEED_USERS.length,
    partnerApiKeySeeded: true,
  });
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  runSeed()
    .then(async () => {
      await getPool().end();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      logger.error('db_seed_failed', { error });
      await getPool().end();
      process.exit(1);
    });
}
