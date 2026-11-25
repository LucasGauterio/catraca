import { Worker, type Job } from 'bullmq';
import { logger } from '../lib/logger';
import {
  getBullMqConnectionOptions,
  PAYMENT_GATEWAY_QUEUE_NAME,
  type PaymentJobPayload,
} from '../lib/queue';

async function processPaymentJob(job: Job<PaymentJobPayload>): Promise<void> {
  logger.info('payment_job_received_bootstrap', {
    jobId: job.id,
    ticketId: job.data.ticketId,
    cardLast4: job.data.cardLast4,
  });
}

/**
 * Bootstraps the Catraca BullMQ worker process for the `payment-gateway` queue.
 */
export function startWorker(): Worker<PaymentJobPayload> {
  const worker = new Worker<PaymentJobPayload>(
    PAYMENT_GATEWAY_QUEUE_NAME,
    processPaymentJob,
    {
      connection: getBullMqConnectionOptions(),
      concurrency: 20,
    },
  );

  worker.on('ready', () => {
    logger.info('worker_started', { queue: PAYMENT_GATEWAY_QUEUE_NAME });
  });

  worker.on('failed', (job, error) => {
    logger.error('worker_job_failed', {
      queue: PAYMENT_GATEWAY_QUEUE_NAME,
      jobId: job?.id,
      error,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('worker_shutting_down', { signal });
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  return worker;
}

startWorker();
