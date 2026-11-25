import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import {
  createSession,
  setSessionCookie,
  validateLoginInput,
  verifyPassword,
} from '@/lib/auth';
import { logger } from '@/lib/logger';

/**
 * Authenticates an organizer or participant by email and password, creating a persisted session cookie.
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

  const parsed = validateLoginInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: 'invalid_request', message: parsed.error },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'invalid_credentials', message: 'E-mail ou senha inválidos.' },
        { status: 401 },
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      logger.warn('auth_login_invalid_password', { email });
      return NextResponse.json(
        { error: 'invalid_credentials', message: 'E-mail ou senha inválidos.' },
        { status: 401 },
      );
    }

    const session = await createSession(user.id);
    await setSessionCookie(session.id, session.expiresAt);

    logger.info('auth_login_succeeded', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error('auth_login_failed', { email, error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Erro ao realizar login.' },
      { status: 500 },
    );
  }
}
