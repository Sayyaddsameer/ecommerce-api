require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 8080,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES) || 15,
  expirationSweepIntervalSeconds:
    Number(process.env.EXPIRATION_SWEEP_INTERVAL_SECONDS) || 60,
};
