import { ApiProperty } from '@nestjs/swagger';
import { ProductStatus } from '../generated/prisma/enums';

// Response shapes. Classes (not interfaces) so the OpenAPI docs at /api/docs
// can describe them; the service still returns plain objects of this shape.

export class RatingSummary {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    description:
      'Average 1..5 rounded to 2 decimals; null when there are no reviews.',
  })
  average!: number | null;

  @ApiProperty({ example: 2 })
  count!: number;
}

export class ProductSummary {
  @ApiProperty({
    example: 'P-10001',
    description: 'Stable PIM identifier, used in URLs.',
  })
  sku!: string;

  @ApiProperty({ example: 'Quorin SF 470' })
  name!: string;

  @ApiProperty({ example: 'Sodium Laureth Sulfate' })
  chemicalName!: string;

  @ApiProperty({ example: 'Surfactant' })
  function!: string;

  @ApiProperty({ example: 'Home Care' })
  applicationArea!: string;

  @ApiProperty({ example: 'EMEA' })
  region!: string;

  @ApiProperty({ type: [String], example: ['Kosher', 'RSPO Mass Balance'] })
  certifications!: string[];

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status!: ProductStatus;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 2012,
    description: 'Null when unknown.',
  })
  launchYear!: number | null;

  @ApiProperty({ type: RatingSummary })
  rating!: RatingSummary;
}

export class ProductDetail extends ProductSummary {
  @ApiProperty()
  description!: string;

  @ApiProperty({
    description:
      'False when the product is no longer in the PIM export. The page stays reachable for old links.',
  })
  isListed!: boolean;
}

export class FacetValue {
  @ApiProperty({ example: 'Surfactant' })
  value!: string;

  @ApiProperty({
    example: 12,
    description: 'Products you would get with this value selected.',
  })
  count!: number;
}

export class ProductFacets {
  @ApiProperty({ type: [FacetValue] })
  function!: FacetValue[];

  @ApiProperty({ type: [FacetValue] })
  applicationArea!: FacetValue[];

  @ApiProperty({ type: [FacetValue] })
  region!: FacetValue[];

  @ApiProperty({ type: [FacetValue] })
  certifications!: FacetValue[];
}

export class ProductSearchResult {
  @ApiProperty({ type: [ProductSummary] })
  items!: ProductSummary[];

  @ApiProperty({ example: 198 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ type: ProductFacets })
  facets!: ProductFacets;
}
