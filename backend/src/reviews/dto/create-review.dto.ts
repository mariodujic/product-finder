import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimToUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Reviews are public and there is no login, so input is validated strictly
 * and stored as plain text. The UI renders it as text (Angular escapes by
 * default), never as HTML.
 */
export class CreateReviewDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'R&D chemist' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  authorName!: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 120, example: 'Easy to formulate' })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({
    minLength: 10,
    maxLength: 2000,
    example: 'Stable viscosity across our whole pH range.',
    description: 'Plain text. Stored and shown as text, never as HTML.',
  })
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  body!: string;

  /**
   * Honeypot. The form hides this field from people; naive spam bots fill in
   * every input. Cheap first line of defence until moderation exists.
   * Deliberately left out of the OpenAPI docs.
   */
  @IsOptional()
  @IsEmpty({ message: 'Invalid submission' })
  website?: string;
}
