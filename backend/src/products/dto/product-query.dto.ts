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

/**
 * Search state. Every field is a URL query parameter, so any result list can be
 * shared as a link.
 */
export class ProductQueryDto {
  /** Free text: matches name, chemical name, SKU and description (partial, case-insensitive). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  function?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  applicationArea?: string[];

  /** A specific region also matches products available globally. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  region?: string[];

  /** Products must carry all selected certifications. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  certifications?: string[];

  /** Discontinued products are hidden unless explicitly requested. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeDiscontinued: boolean = false;

  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort: SortOption = 'name';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}
