import { Queue, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

const DEFAULT_REDIS_URL = 'redis://localhost:63799';

export const PAYMENT_GATEWAY_QUEUE_NAME = 'payment-gateway';
export const PAYMENT_QUEUE_NAME = PAYMENT_GATEWAY_QUEUE_NAME;

export interface PaymentJobPayload {
  ticketId: string;
  cardLast4: string;
}

const globalForQueue = globalThis as unknown as {
  catracaRedisClient?: Redis;
  catracaPaymentQueue?: Queue<PaymentJobPayload>;
};

/**
 * Parses `REDIS_URL` into BullMQ-compatible `ConnectionOptions`.
 */
export function getBullMqConnectionOptions(): ConnectionOptions {
  const rawUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
  const parsed = new URL(rawUrl);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Returns the singleton `ioredis` client for direct Redis commands (e.g., health checks).
 */
export function getRedisClient(): Redis {
  if (!globalForQueue.catracaRedisClient) {
    const rawUrl = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
    globalForQueue.catracaRedisClient = new Redis(rawUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return globalForQueue.catracaRedisClient;
}

/**
 * Returns the singleton BullMQ `payment-gateway` queue used to enqueue simulated payment jobs.
 */
export function getPaymentGatewayQueue(): Queue<PaymentJobPayload> {
  if (!globalForQueue.catracaPaymentQueue) {
    globalForQueue.catracaPaymentQueue = new Queue<PaymentJobPayload>(
      PAYMENT_GATEWAY_QUEUE_NAME,
      {
        connection: getBullMqConnectionOptions(),
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      },
    );
  }
  return globalForQueue.catracaPaymentQueue;
}

/**
 * Alias for `getPaymentGatewayQueue` for ergonomic imports across features.
 */
export const getPaymentQueue = getPaymentGatewayQueue;

/**
 * Verifies Redis connectivity by sending a `PING` command.
 */
export async function checkRedisHealth(): Promise<boolean> {
  const client = getRedisClient();
  const response = await client.ping();
  return response === 'PONG';
}
