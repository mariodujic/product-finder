import { Prisma } from '../generated/prisma/client';

/**
 * Recomputes a product's review count and average from the reviews table.
 * Recomputing (rather than incrementing) keeps the aggregate exact, with no
 * rounding drift. Call it inside the transaction that wrote the review, after
 * locking the product row, so concurrent reviews can't miss each other.
 */
export async function refreshRatingAggregate(
  tx: Prisma.TransactionClient,
  productId: number,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE products p
    SET review_count = s.review_count, rating_avg = s.rating_avg
    FROM (
      SELECT count(*)::int AS review_count, round(avg(rating)::numeric, 2) AS rating_avg
      FROM reviews WHERE product_id = ${productId}
    ) s
    WHERE p.id = ${productId}`;
}
