import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SORT_OPTIONS = [
  'name',
  '-name',
  'launchYear',
  '-launchYear',
  '-rating',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const MAX_PAGE_SIZE = 100;

/** Accepts `?region=EMEA&region=Global` (repeated) as well as a single value. */
const toStringArray = ({ value }: TransformFnParams): unknown => {
  if (value === undefined || value === '') return undefined;
  const values: unknown[] = Array.isArray(value) ? value : [value];
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : v))
    .filter((v) => v !== '');
};

const toBoolean = ({ value }: TransformFnParams): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** OpenAPI shape of a repeatable filter: `?region=EMEA&region=Global`. */
const filterDoc = { type: String, isArray: true, maxItems: 50 };

/**
 * Search state. Every field is a URL query parameter, so any result list can be
 * shared as a link.
 */
export class ProductQueryDto {
  /** Free text: matches name, chemical name, SKU and description (partial, case-insensitive). */
  @ApiPropertyOptional({
    maxLength: 100,
    example: 'polysorbate',
    description:
      'Free text. Matches name, chemical name, SKU and description (partial, case-insensitive). Every word must match.',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    ...filterDoc,
    example: ['Emulsifier'],
    description: 'Repeat for several values; a product matches any of them.',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  function?: string[];

  @ApiPropertyOptional({
    ...filterDoc,
    example: ['Personal Care'],
    description: 'Repeat for several values; a product matches any of them.',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  applicationArea?: string[];

  /** A specific region also matches products available globally. */
  @ApiPropertyOptional({
    ...filterDoc,
    example: ['EMEA'],
    description:
      'Repeat for several values; a product matches any of them. A specific region also matches products marked Global.',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  region?: string[];

  /** Products must carry all selected certifications. */
  @ApiPropertyOptional({
    ...filterDoc,
    example: ['Vegan', 'Halal'],
    description: 'Repeat for several values; a product must carry ALL of them.',
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  certifications?: string[];

  /** Discontinued products are hidden unless explicitly requested. */
  @ApiPropertyOptional({
    default: false,
    description:
      'Discontinued products are hidden unless this is true. Delisted products are never searchable.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDiscontinued: boolean = false;

  @ApiPropertyOptional({
    enum: SORT_OPTIONS,
    default: 'name',
    description: 'A leading "-" sorts descending.',
  })
  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort: SortOption = 'name';

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}
