const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = ['src', 'tests'];
const IGNORED_DIRS = new Set(['node_modules', 'coverage', 'uploads', 'tmp']);

function collectJsFiles(dir, output) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        collectJsFiles(fullPath, output);
      }
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.js')) {
      output.push(fullPath);
    }
  }
}

function checkFileSyntax(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return null;
  }

  return result.stderr || result.stdout || `Syntax check failed: ${filePath}`;
}

function main() {
  const files = [];

  for (const dir of TARGET_DIRS) {
    const targetPath = path.join(ROOT, dir);
    if (fs.existsSync(targetPath)) {
      collectJsFiles(targetPath, files);
    }
  }

  if (files.length === 0) {
    console.log('No JS files found for lint.');
    return;
  }

  const failures = [];

  for (const file of files) {
    const failure = checkFileSyntax(file);
    if (failure) {
      failures.push({ file, failure });
    }
  }

  if (failures.length > 0) {
    console.error(`Lint failed for ${failures.length} file(s).`);
    for (const item of failures) {
      console.error(`\n[${item.file}]\n${item.failure}`);
    }
    process.exit(1);
  }

  console.log(`Lint passed. Checked ${files.length} file(s).`);
}

main();
