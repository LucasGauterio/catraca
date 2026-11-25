import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export type UserRole = 'organizer' | 'participant';
export type EventStatus = 'draft' | 'published' | 'cancelled';
export type TicketStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded';
export type TicketChannel = 'web' | 'partner';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_sessions_user_id').on(table.userId)],
);

export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    location: text('location').notNull(),
    capacity: integer('capacity').notNull(),
    priceCents: integer('price_cents').notNull(),
    status: text('status').$type<EventStatus>().default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_events_organizer_id').on(table.organizerId),
    index('idx_events_status').on(table.status),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    userId: text('user_id').references(() => users.id),
    buyerEmail: text('buyer_email').notNull(),
    channel: text('channel').$type<TicketChannel>().notNull(),
    priceCents: integer('price_cents').notNull(),
    status: text('status').$type<TicketStatus>().notNull(),
    checkedIn: boolean('checked_in').default(false).notNull(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tickets_event_status').on(table.eventId, table.status),
    index('idx_tickets_code').on(table.code),
    index('idx_tickets_user_id').on(table.userId),
  ],
);

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
