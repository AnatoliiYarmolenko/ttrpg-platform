const { spawnSync } = require('node:child_process');

const REDIS_CONTAINER = 'ttrpg_redis';
const PATTERN = 'rateLimit:*';

function main() {
  console.log(`Clearing rate limit keys with pattern: ${PATTERN}`);

  // Scan for keys matching the pattern
  const scanResult = spawnSync(
    'docker',
    ['exec', REDIS_CONTAINER, 'redis-cli', '--scan', '--pattern', PATTERN],
    { encoding: 'utf8' }
  );

  if (scanResult.status !== 0) {
    console.error('Failed to scan Redis keys:', scanResult.stderr);
    process.exit(1);
  }

  const keys = scanResult.stdout.trim().split('\n').filter(Boolean);

  if (keys.length === 0) {
    console.log('No rate limit keys found.');
    return;
  }

  console.log(`Found ${keys.length} rate limit key(s). Deleting...`);

  // Delete each key
  let deletedCount = 0;
  for (const key of keys) {
    const delResult = spawnSync(
      'docker',
      ['exec', REDIS_CONTAINER, 'redis-cli', 'del', key],
      { encoding: 'utf8' }
    );

    if (delResult.status === 0) {
      deletedCount++;
    } else {
      console.error(`Failed to delete key: ${key}`);
    }
  }

  console.log(`Successfully deleted ${deletedCount}/${keys.length} rate limit key(s).`);
}

main();
