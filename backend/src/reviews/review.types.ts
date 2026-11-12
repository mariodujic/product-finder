import { ApiProperty } from '@nestjs/swagger';

// Response shapes, as classes so the OpenAPI docs can describe them.

export class ReviewView {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'R&D chemist' })
  authorName!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  rating!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Easy to formulate' })
  title!: string | null;

  @ApiProperty({ example: 'Stable viscosity across our whole pH range.' })
  body!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ReviewPage {
  @ApiProperty({ type: [ReviewView] })
  items!: ReviewView[];

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}
