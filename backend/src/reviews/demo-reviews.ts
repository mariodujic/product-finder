import { PrismaClient } from '../generated/prisma/client';
import { refreshRatingAggregate } from './rating-aggregate';

export interface DemoReview {
  sku: string;
  authorName: string;
  rating: number;
  title?: string;
  body: string;
}

/**
 * Sample reviews so a fresh installation doesn't look empty. Author names are
 * marked "(demo)" so they can't be mistaken for real customer feedback.
 */
export const DEMO_REVIEWS: DemoReview[] = [
  {
    sku: 'P-10001',
    authorName: 'Formulation chemist (demo)',
    rating: 5,
    title: 'Reliable base surfactant',
    body: 'Consistent quality across batches and very easy to process in our dishwashing liquid. Foam profile exactly as specified.',
  },
  {
    sku: 'P-10001',
    authorName: 'Procurement, home care (demo)',
    rating: 4,
    body: 'Good price-performance. Kosher certificate was important for one of our private-label customers.',
  },
  {
    sku: 'P-10002',
    authorName: 'Agro formulator (demo)',
    rating: 4,
    title: 'Stable emulsions',
    body: 'Emulsion stayed stable through our 8-week storage test at 40 °C. Slightly higher dosage needed than with our previous emulsifier.',
  },
  {
    sku: 'P-10010',
    authorName: 'R&D, personal care (demo)',
    rating: 5,
    title: 'Clear gels, no haze',
    body: 'Gives crystal-clear gels at low use levels. Vegan certification made the switch easy to justify internally.',
  },
  {
    sku: 'P-10011',
    authorName: 'Coatings lab (demo)',
    rating: 3,
    body: 'Thickening works, but it needs careful pH control in our waterborne system. Technical support was helpful.',
  },
  {
    sku: 'P-10018',
    authorName: 'QA pharmaceuticals (demo)',
    rating: 4,
    title: 'Effective at low dosage',
    body: 'Documentation for the REACH registration was complete, which shortened our supplier qualification.',
  },
];

export interface DemoSeedResult {
  inserted: number;
  existing: number;
  missingProducts: string[];
}

/**
 * Inserts the demo reviews that don't exist yet. A review counts as existing
 * when the same author already posted the same text on the same product, so
 * running this again changes nothing, and real user reviews are never touched.
 */
export async function seedDemoReviews(
  prisma: PrismaClient,
  reviews: DemoReview[] = DEMO_REVIEWS,
): Promise<DemoSeedResult> {
  const result: DemoSeedResult = {
    inserted: 0,
    existing: 0,
    missingProducts: [],
  };

  for (const demo of reviews) {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { sku: demo.sku },
        select: { id: true },
      });
      if (!product) {
        result.missingProducts.push(demo.sku);
        return;
      }
      const exists = await tx.review.findFirst({
        where: {
          productId: product.id,
          authorName: demo.authorName,
          body: demo.body,
        },
        select: { id: true },
      });
      if (exists) {
        result.existing++;
        return;
      }
      await tx.review.create({
        data: {
          productId: product.id,
          authorName: demo.authorName,
          rating: demo.rating,
          title: demo.title ?? null,
          body: demo.body,
        },
      });
      await refreshRatingAggregate(tx, product.id);
      result.inserted++;
    });
  }
  return result;
}
