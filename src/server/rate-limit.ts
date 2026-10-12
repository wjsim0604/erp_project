import { createHash } from 'node:crypto';
import { getDataSource } from './data-source';
import { ApiRequestLimit } from './entities';

export async function checkRateLimit(identity: string, action: string, maximum: number, windowSeconds: number) {
  if (!Number.isInteger(maximum) || maximum < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new Error('Invalid rate limit configuration');
  const bucketKey = createHash('sha256').update(`${action}:${identity}`).digest('hex');
  const db = await getDataSource();
  const seconds = Math.min(windowSeconds, 86400);
  await db.query(`INSERT INTO api_request_limits (bucket_key, window_started, hit_count)
    VALUES (?, UTC_TIMESTAMP(6), 1)
    ON DUPLICATE KEY UPDATE
      hit_count = IF(window_started <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${seconds} SECOND), 1, hit_count + 1),
      window_started = IF(window_started <= DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${seconds} SECOND), UTC_TIMESTAMP(6), window_started)`, [bucketKey]);
  const row = await db.getRepository(ApiRequestLimit).findOneBy({ bucketKey });
  return (row?.hitCount ?? 0) <= maximum;
}
