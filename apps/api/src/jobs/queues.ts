import { Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ai } from '../integrations/ai';

const redisUrl = new URL(env.REDIS_URL);
const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null,
};

export const queues =
  env.NODE_ENV === 'test'
    ? ({} as Record<'moderation' | 'notifications' | 'media' | 'scheduledPosts', Queue>)
    : {
        moderation: new Queue('moderation', { connection }),
        notifications: new Queue('notifications', { connection }),
        media: new Queue('media', { connection }),
        scheduledPosts: new Queue('scheduled-posts', { connection }),
      };

export async function enqueue(queueName: keyof typeof queues, name: string, data: unknown, opts?: JobsOptions) {
  if (env.NODE_ENV === 'test') {
    return { id: `test-${name}`, name, data };
  }
  return queues[queueName].add(name, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
    ...opts,
  });
}

export function startWorkers() {
  if (env.NODE_ENV === 'test') {
    return [];
  }
  const workers = [
    new Worker(
      'moderation',
      async (job) => {
        if (job.name === 'moderate-text') {
          return ai.moderation(JSON.stringify(job.data));
        }
        return null;
      },
      { connection },
    ),
    new Worker(
      'notifications',
      async (job) => {
        logger.info('Notification job processed', { name: job.name, data: job.data });
        return true;
      },
      { connection },
    ),
  ];

  workers.forEach((worker) => {
    worker.on('failed', (job, error) => logger.warn('Queue job failed', { jobId: job?.id, error }));
  });

  return workers;
}
