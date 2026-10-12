import * as fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fail } from './errors.js';

export async function writeDump(path, rows, filesystem = fs) {
  const outputPath = resolve(path);
  const json = `${JSON.stringify(rows, null, 2)}\n`;
  let handle;
  let parentReady = false;
  try {
    await filesystem.mkdir(dirname(outputPath), { recursive: true });
    parentReady = true;
    // Exclusive creation protects existing files, including concurrent writers.
    handle = await filesystem.open(outputPath, 'wx', 0o600);
    try {
      await handle.writeFile(json, 'utf8');
    } finally {
      await handle.close();
    }
    return outputPath;
  } catch (error) {
    if (handle) {
      try {
        await filesystem.unlink(outputPath);
      } catch {
        fail('DUMP_CLEANUP_FAILED');
      }
    }
    fail(
      parentReady && !handle && error.code === 'EEXIST' ? 'DUMP_FILE_EXISTS' : 'DUMP_WRITE_FAILED'
    );
  }
}
