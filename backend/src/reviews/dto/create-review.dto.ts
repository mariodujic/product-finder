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
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  authorName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(120)
  title?: string;

  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  body!: string;

  /**
   * Honeypot. The form hides this field from people; naive spam bots fill in
   * every input. Cheap first line of defence until moderation exists.
   */
  @IsOptional()
  @IsEmpty({ message: 'Invalid submission' })
  website?: string;
}
