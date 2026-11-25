import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { UserRole } from '../db/schema';
import { generateId } from './ids';

export { generateId };

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type RoleAccessResult =
  | { allowed: true; user: AuthenticatedUser }
  | { allowed: false; statusCode: 401 | 403; code: 'unauthorized' | 'forbidden'; message: string };

/**
 * Evaluates whether a session user satisfies an optional required role (base of R13).
 */
export function checkRoleAccess(
  user: AuthenticatedUser | null,
  requiredRole?: UserRole,
): RoleAccessResult {
  if (!user) {
    return {
      allowed: false,
      statusCode: 401,
      code: 'unauthorized',
      message: 'Autenticação necessária.',
    };
  }
  if (requiredRole && user.role !== requiredRole) {
    const message =
      requiredRole === 'organizer'
        ? 'Acesso restrito a organizadores.'
        : 'Acesso restrito a participantes.';
    return {
      allowed: false,
      statusCode: 403,
      code: 'forbidden',
      message,
    };
  }
  return { allowed: true, user };
}

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Generates a 64-character hex cryptographic session token (32 random bytes).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a plaintext password using Node.js `crypto.scrypt` with a 16-byte random salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) {
    return false;
  }
  const storedKey = Buffer.from(keyHex, 'hex');
  const derived = (await scryptAsync(password, salt, storedKey.length)) as Buffer;
  if (storedKey.length !== derived.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedKey, derived);
}

/**
 * Computes the SHA-256 hex digest of a Partner API key for storage and lookup.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Validates basic email address format.
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates and normalizes participant registration input payload.
 */
export function validateRegistrationInput(input: unknown): ValidationResult<RegistrationInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Dados de cadastro inválidos.' };
  }
  const record = input as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (name.length < 2) {
    return { ok: false, error: 'Informe um nome com pelo menos 2 caracteres.' };
  }
  if (!validateEmail(email)) {
    return { ok: false, error: 'Informe um e-mail válido.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }

  return { ok: true, data: { name, email, password } };
}

/**
 * Validates and normalizes login input payload.
 */
export function validateLoginInput(input: unknown): ValidationResult<LoginInput> {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Credenciais inválidas.' };
  }
  const record = input as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const password = typeof record.password === 'string' ? record.password : '';

  if (!validateEmail(email) || password.length === 0) {
    return { ok: false, error: 'Informe e-mail e senha válidos.' };
  }

  return { ok: true, data: { email, password } };
}
