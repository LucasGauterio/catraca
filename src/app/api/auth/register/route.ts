import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  createSession,
  generateId,
  hashPassword,
  setSessionCookie,
  validateRegistrationInput,
} from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Registers a new participant account (`role = 'participant'`), opens a session, and sets the session cookie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Corpo JSON inválido.' },
      { status: 400 },
    );
  }

  const parsed = validateRegistrationInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'invalid_request', message: parsed.error },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'email_already_registered', message: 'Este e-mail já está cadastrado.' },
        { status: 409 },
      );
    }

    const userId = generateId('usr');
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash,
      role: 'participant',
    });

    const session = await createSession(userId);
    await setSessionCookie(session.id, session.expiresAt);

    logger.info('auth_user_registered', {
      userId,
      email,
      role: 'participant',
    });

    return NextResponse.json(
      {
        user: {
          id: userId,
          name,
          email,
          role: 'participant' as const,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    logger.error('auth_register_failed', { email, error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao criar conta.' },
      { status: 500 },
    );
  }
}
