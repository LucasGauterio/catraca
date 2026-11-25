import { Worker, type Job } from 'bullmq';
import { logger } from '../lib/logger';
import {
  getBullMqConnectionOptions,
  PAYMENT_GATEWAY_QUEUE_NAME,
  type PaymentJobPayload,
} from '../lib/queue';
import { processPaymentJob } from './payment-processor';

async function handlePaymentJob(job: Job<PaymentJobPayload>): Promise<void> {
  await processPaymentJob(job.data);
}

/**
 * Bootstraps the Catraca BullMQ worker process for the `payment-gateway` queue
 * with concurrency 20 so slow (`0003`/`0004`) and fast (`0001`/`0002`) cards
 * process concurrently without head-of-line blocking.
 */
export function startWorker(): Worker<PaymentJobPayload> {
  const worker = new Worker<PaymentJobPayload>(
    PAYMENT_GATEWAY_QUEUE_NAME,
    handlePaymentJob,
    {
      connection: getBullMqConnectionOptions(),
      concurrency: 20,
    },
  );

  worker.on('ready', () => {
    logger.info('worker_started', {
      queue: PAYMENT_GATEWAY_QUEUE_NAME,
      concurrency: 20,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('worker_job_failed', {
      queue: PAYMENT_GATEWAY_QUEUE_NAME,
      jobId: job?.id,
      ticketId: job?.data?.ticketId,
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
