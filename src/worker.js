// Standalone background worker process. Runs separately from the API
// server (see docker-compose.yml's `worker` service) so that expiration
// sweeps never block or share failure modes with request handling.

const { createExpirationQueue, scheduleRepeatingSweep, startExpirationWorker } = require('./workers/queue');

async function main() {
  const queue = createExpirationQueue();
  await scheduleRepeatingSweep(queue);
  startExpirationWorker();
  console.log('[worker] reservation-expiration worker started');
}

main().catch((err) => {
  console.error('[worker] fatal startup error:', err);
  process.exit(1);
});
