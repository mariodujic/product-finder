/**
 * Adds sample reviews (marked "(demo)") for a nicer first impression.
 *
 *   npm run seed:demo-reviews
 *
 * Idempotent: running it again inserts nothing. Real reviews are never touched.
 */
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { seedDemoReviews } from './demo-reviews';

async function main(): Promise<number> {
  const logger = new Logger('DemoReviews');
  const prisma = new PrismaService();
  try {
    const r = await seedDemoReviews(prisma);
    logger.log(`${r.inserted} inserted, ${r.existing} already present`);
    if (r.missingProducts.length) {
      logger.warn(
        `Skipped, product not found: ${r.missingProducts.join(', ')}`,
      );
    }
    return 0;
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().then((code) => process.exit(code));
