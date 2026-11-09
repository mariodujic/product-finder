import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ImportRunStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { analyzeExport } from './analyze-export';
import { buildImportPlan, HashedProduct, ImportPlan } from './import-plan';
import { ImportIssue, ImportOptions } from './import.types';

/** Arbitrary constant: serialises concurrent imports (e.g. a cron job overlapping a manual run). */
const IMPORT_LOCK_KEY = 7_301_001;
const WRITE_CHUNK_SIZE = 1000;
/** Keeps the audit row bounded when a 50k-row export is badly broken. */
const MAX_STORED_ISSUES = 1000;

export interface ImportSummary {
  runId: number;
  status: ImportRunStatus;
  rowsRead: number;
  inserted: number;
  updated: number;
  unchanged: number;
  relisted: number;
  delisted: number;
  skipped: number;
  issues: ImportIssue[];
  abortReason?: string;
}

/**
 * Loads a PIM export into the database. Safe to run any number of times:
 * products are matched by SKU, unchanged rows are not touched, nothing is ever
 * hard-deleted, and reviews are never read or written here.
 */
@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importFile(
    path: string,
    options: ImportOptions = {},
  ): Promise<ImportSummary> {
    const content = await readFile(path, 'utf8');
    return this.importContent(content, path, options);
  }

  async importContent(
    content: string,
    source: string,
    options: ImportOptions = {},
  ): Promise<ImportSummary> {
    const checksum = createHash('sha256').update(content).digest('hex');
    const run = await this.prisma.importRun.create({
      data: { source, fileChecksum: checksum },
    });

    try {
      const analysis = analyzeExport(content);
      const plan = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;
          const existing = await tx.product.findMany({
            select: { sku: true, contentHash: true, isListed: true },
          });
          const planned = buildImportPlan(
            analysis.products,
            analysis.seenSkus,
            existing,
            options,
          );
          if (!planned.abortReason) await this.apply(tx, planned, run.id);
          return planned;
        },
        { maxWait: 30_000, timeout: 10 * 60_000 },
      );

      const summary: ImportSummary = {
        runId: run.id,
        status: plan.abortReason
          ? ImportRunStatus.ABORTED
          : ImportRunStatus.SUCCEEDED,
        rowsRead: analysis.rowsRead,
        inserted: plan.abortReason ? 0 : plan.toInsert.length,
        updated: plan.abortReason ? 0 : plan.toUpdate.length,
        unchanged: plan.abortReason ? 0 : plan.unchanged,
        relisted: plan.abortReason ? 0 : plan.toRelist.length,
        delisted: plan.abortReason ? 0 : plan.toDelist.length,
        skipped: analysis.skipped,
        issues: analysis.issues,
        abortReason: plan.abortReason,
      };
      await this.finishRun(summary);
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Import ${run.id} failed: ${message}`);
      await this.prisma.importRun.update({
        where: { id: run.id },
        data: {
          status: ImportRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      throw err;
    }
  }

  private async apply(
    tx: Prisma.TransactionClient,
    plan: ImportPlan,
    runId: number,
  ): Promise<void> {
    const toRow = (p: HashedProduct) => ({
      ...p,
      isListed: true,
      lastImportRunId: runId,
    });

    for (const chunk of chunks(plan.toInsert, WRITE_CHUNK_SIZE)) {
      await tx.product.createMany({ data: chunk.map(toRow) });
    }
    // Updates are row-by-row. A nightly diff is small; the worst case (every
    // product changed) is still fine for a batch job. See DECISIONS.md.
    for (const product of plan.toUpdate) {
      await tx.product.update({
        where: { sku: product.sku },
        data: toRow(product),
      });
    }
    for (const chunk of chunks(plan.toRelist, WRITE_CHUNK_SIZE)) {
      await tx.product.updateMany({
        where: { sku: { in: chunk } },
        data: { isListed: true, lastImportRunId: runId },
      });
    }
    for (const chunk of chunks(plan.toDelist, WRITE_CHUNK_SIZE)) {
      await tx.product.updateMany({
        where: { sku: { in: chunk } },
        data: { isListed: false, lastImportRunId: runId },
      });
    }
  }

  private async finishRun(summary: ImportSummary): Promise<void> {
    const stored = summary.issues.slice(0, MAX_STORED_ISSUES);
    if (summary.issues.length > MAX_STORED_ISSUES) {
      stored.push({
        level: 'warning',
        message: `${summary.issues.length - MAX_STORED_ISSUES} more issues not stored`,
      });
    }
    await this.prisma.importRun.update({
      where: { id: summary.runId },
      data: {
        status: summary.status,
        finishedAt: new Date(),
        rowsRead: summary.rowsRead,
        inserted: summary.inserted,
        updated: summary.updated,
        unchanged: summary.unchanged,
        relisted: summary.relisted,
        delisted: summary.delisted,
        skipped: summary.skipped,
        issues: stored as unknown as Prisma.InputJsonValue,
        errorMessage: summary.abortReason ?? null,
      },
    });
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}
