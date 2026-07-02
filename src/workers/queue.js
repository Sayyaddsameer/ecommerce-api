const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const config = require('../config');
const { releaseExpiredReservations } = require('./expirationWorker');

const QUEUE_NAME = 'reservation-expiration';

function createConnection() {
  return new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
}

function createExpirationQueue() {
  const connection = createConnection();
  return new Queue(QUEUE_NAME, { connection });
}

async function scheduleRepeatingSweep(queue) {
  await queue.add(
    'sweep',
    {},
    {
      repeat: { every: config.expirationSweepIntervalSeconds * 1000 },
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

function startExpirationWorker() {
  const connection = createConnection();
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const result = await releaseExpiredReservations();
      if (result.released > 0) {
        console.log(
          `[expiration-worker] released ${result.released} expired cart item(s) across ${result.variants_affected} variant(s)`
        );
      }
      return result;
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[expiration-worker] sweep job failed:', err);
  });

  return worker;
}

module.exports = { createExpirationQueue, scheduleRepeatingSweep, startExpirationWorker, QUEUE_NAME };
