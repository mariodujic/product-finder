/**
 * Imports a PIM CSV export.
 *
 *   npm run import -- <path-to-csv> [--force]
 *
 * Exit codes: 0 succeeded, 1 failed, 2 aborted by a safety check (nothing changed).
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { ImportRunStatus } from '../generated/prisma/enums';
import { ImportModule } from './import.module';
import { ImportService } from './import.service';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const file = args.find((a) => !a.startsWith('--'));
  const logger = new Logger('Import');

  if (!file) {
    logger.error('Usage: npm run import -- <path-to-csv> [--force]');
    return 1;
  }

  const app = await NestFactory.createApplicationContext(ImportModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const path = resolve(file);
    logger.log(`Importing ${path}${force ? ' (--force)' : ''}`);
    const s = await app.get(ImportService).importFile(path, { force });

    for (const issue of s.issues) {
      const where = [issue.line && `line ${issue.line}`, issue.sku]
        .filter(Boolean)
        .join(' ');
      const text = `${where ? `[${where}] ` : ''}${issue.message}`;
      if (issue.level === 'error') logger.error(text);
      else logger.warn(text);
    }
    logger.log(
      `Run #${s.runId} ${s.status}: ${s.rowsRead} rows read, ${s.inserted} inserted, ` +
        `${s.updated} updated, ${s.unchanged} unchanged, ${s.relisted} relisted, ` +
        `${s.delisted} delisted, ${s.skipped} rows skipped`,
    );
    if (s.status === ImportRunStatus.ABORTED) {
      logger.error(`Aborted, nothing was changed: ${s.abortReason}`);
      return 2;
    }
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    await app.close();
  }
}

void main().then((code) => process.exit(code));
