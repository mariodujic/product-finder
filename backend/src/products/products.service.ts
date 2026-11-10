import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';
import {
  buildOrderBy,
  buildProductWhere,
  ScalarFacet,
} from './product-query-builder';
import {
  FacetValue,
  ProductDetail,
  ProductFacets,
  ProductSearchResult,
  ProductSummary,
} from './product.types';

const summarySelect = {
  sku: true,
  name: true,
  chemicalName: true,
  function: true,
  applicationArea: true,
  region: true,
  certifications: true,
  status: true,
  launchYear: true,
  ratingAvg: true,
  reviewCount: true,
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof summarySelect }>;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: ProductQueryDto): Promise<ProductSearchResult> {
    const where = buildProductWhere(query);
    const [rows, total, facets] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: buildOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: summarySelect,
      }),
      this.prisma.product.count({ where }),
      this.facets(query),
    ]);
    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
      facets,
    };
  }

  /** Any product that was ever imported, listed or not: shared links must keep working. */
  async findBySku(sku: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findUnique({
      where: { sku: sku.trim().toUpperCase() },
      select: { ...summarySelect, description: true, isListed: true },
    });
    if (!row) throw new NotFoundException(`Product ${sku} not found`);
    return {
      ...toSummary(row),
      description: row.description,
      isListed: row.isListed,
    };
  }

  private async facets(query: ProductQueryDto): Promise<ProductFacets> {
    const [fn, applicationArea, region, certifications] = await Promise.all([
      this.countBy('function', query),
      this.countBy('applicationArea', query),
      this.countBy('region', query),
      this.certificationCounts(query),
    ]);
    return { function: fn, applicationArea, region, certifications };
  }

  private async countBy(
    field: ScalarFacet,
    query: ProductQueryDto,
  ): Promise<FacetValue[]> {
    const groups = await this.prisma.product.groupBy({
      by: [field],
      where: buildProductWhere(query, field),
      _count: { _all: true },
    });
    // Facet lists are tiny (one entry per distinct value), so sorting here is free.
    return groups
      .map((g) => ({ value: g[field], count: g._count._all }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }

  /**
   * Certifications are an array column, so they can't use groupBy. The set of
   * certification names is small (single digits today), so one count per value is cheap.
   */
  private async certificationCounts(
    query: ProductQueryDto,
  ): Promise<FacetValue[]> {
    const values = await this.prisma.$queryRaw<{ value: string }[]>`
      SELECT DISTINCT unnest(certifications) AS value
      FROM products WHERE is_listed ORDER BY value`;
    const where = buildProductWhere(query);
    return Promise.all(
      values.map(async ({ value }) => ({
        value,
        count: await this.prisma.product.count({
          where: { AND: [where, { certifications: { has: value } }] },
        }),
      })),
    );
  }
}

function toSummary(row: SummaryRow): ProductSummary {
  return {
    sku: row.sku,
    name: row.name,
    chemicalName: row.chemicalName,
    function: row.function,
    applicationArea: row.applicationArea,
    region: row.region,
    certifications: row.certifications,
    status: row.status,
    launchYear: row.launchYear,
    rating: {
      average: row.ratingAvg === null ? null : Number(row.ratingAvg),
      count: row.reviewCount,
    },
  };
}
