import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from '@prisma/config';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

loadDotenv({
  path: resolve(currentDirPath, '../.env'),
});

export default defineConfig({
  seed: 'node prisma/seed.js',
});
