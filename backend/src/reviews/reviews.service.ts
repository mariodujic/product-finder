import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Review } from '../generated/prisma/client';
import { ProductStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { refreshRatingAggregate } from './rating-aggregate';
import { ReviewPage, ReviewView } from './review.types';

interface LockedProduct {
  id: number;
  status: ProductStatus;
  is_listed: boolean;
}

export const normalizeSku = (sku: string) => sku.trim().toUpperCase();

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first. Reviews stay readable for every product, including discontinued ones. */
  async list(sku: string, query: ReviewQueryDto): Promise<ReviewPage> {
    const product = await this.prisma.product.findUnique({
      where: { sku: normalizeSku(sku) },
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);

    const where = { productId: product.id };
    const [rows, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items: rows.map(toView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Creates a review and refreshes the product's rating in one transaction.
   * The product row is locked first, so two simultaneous reviews are applied
   * one after the other and the aggregate counts both.
   */
  async create(sku: string, dto: CreateReviewDto): Promise<ReviewView> {
    return this.prisma.$transaction(async (tx) => {
      const [product] = await tx.$queryRaw<LockedProduct[]>`
        SELECT id, status, is_listed FROM products
        WHERE sku = ${normalizeSku(sku)} FOR UPDATE`;
      if (!product) throw new NotFoundException(`Product ${sku} not found`);
      if (!product.is_listed || product.status === ProductStatus.DISCONTINUED) {
        throw new ConflictException(
          'This product is no longer sold, so it cannot receive new reviews',
        );
      }

      const review = await tx.review.create({
        data: {
          productId: product.id,
          authorName: dto.authorName,
          rating: dto.rating,
          title: dto.title ?? null,
          body: dto.body,
        },
      });
      await refreshRatingAggregate(tx, product.id);
      return toView(review);
    });
  }
}

function toView(review: Review): ReviewView {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    createdAt: review.createdAt.toISOString(),
  };
}
