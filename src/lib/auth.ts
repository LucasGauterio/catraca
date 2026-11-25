import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { apiKeys, sessions, users } from '@/db/schema';
import {
  checkRoleAccess,
  generateId,
  generateSessionToken,
  hashApiKey,
  hashPassword,
  validateEmail,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
  type AuthenticatedUser,
} from './auth-utils';

export {
  checkRoleAccess,
  generateId,
  generateSessionToken,
  hashApiKey,
  hashPassword,
  validateEmail,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
  type AuthenticatedUser,
};

export const SESSION_COOKIE_NAME = 'catraca_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Error thrown by RBAC guards (`requireAuth`, `requireUser`, `requireOrganizer`, `requireParticipant`)
 * containing the appropriate HTTP status code (401 or 403).
 */
export class AuthError extends Error {
  public readonly statusCode: 401 | 403;
  public readonly code: 'unauthorized' | 'forbidden';

  constructor(statusCode: 401 | 403, code: 'unauthorized' | 'forbidden', message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Creates a persisted session row in PostgreSQL for the given user ID.
 */
export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
  });

  return { id, expiresAt };
}

/**
 * Deletes a persisted session by token ID.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Sets the HttpOnly session cookie (`catraca_session`) on the current Next.js response.
 */
export async function setSessionCookie(sessionId: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    secure: false,
  });
}

/**
 * Clears the session cookie (`catraca_session`) on the current Next.js response.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: false,
  });
}

/**
 * Deletes the active session from PostgreSQL (if any) and clears the `catraca_session` cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }
  await clearSessionCookie();
}

/**
 * Resolves the currently authenticated user from the `catraca_session` cookie, or returns `null`.
 */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    return null;
  }

  const now = new Date();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

/**
 * Requires any authenticated user; throws `AuthError(401)` if unauthenticated.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getSessionUser();
  const access = checkRoleAccess(user);
  if (!access.allowed) {
    throw new AuthError(access.statusCode, access.code, access.message);
  }
  return access.user;
}

/**
 * Alias for `requireUser()` for ergonomic imports across API routes and Server Components.
 */
export const requireAuth = requireUser;

/**
 * Requires an authenticated organizer (R13); throws `AuthError(401)` or `AuthError(403)`.
 */
export async function requireOrganizer(): Promise<AuthenticatedUser> {
  const user = await getSessionUser();
  const access = checkRoleAccess(user, 'organizer');
  if (!access.allowed) {
    throw new AuthError(access.statusCode, access.code, access.message);
  }
  return access.user;
}

/**
 * Requires an authenticated participant; throws `AuthError(401)` or `AuthError(403)`.
 */
export async function requireParticipant(): Promise<AuthenticatedUser> {
  const user = await getSessionUser();
  const access = checkRoleAccess(user, 'participant');
  if (!access.allowed) {
    throw new AuthError(access.statusCode, access.code, access.message);
  }
  return access.user;
}

/**
 * Verifies a Partner API key (`X-Api-Key`) against active SHA-256 hashes in `api_keys`.
 */
export async function verifyPartnerApiKey(rawKey: string | null | undefined): Promise<boolean> {
  if (!rawKey || rawKey.trim().length === 0) {
    return false;
  }
  const keyHash = hashApiKey(rawKey.trim());
  const rows = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);

  return rows.length > 0;
}
