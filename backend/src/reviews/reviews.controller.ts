import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewPage, ReviewView } from './review.types';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiParam({ name: 'sku', example: 'P-10001' })
@ApiNotFoundResponse({ description: 'Unknown SKU.' })
@Controller('products/:sku/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews, newest first' })
  @ApiOkResponse({ type: ReviewPage })
  list(
    @Param('sku') sku: string,
    @Query() query: ReviewQueryDto,
  ): Promise<ReviewPage> {
    return this.reviews.list(sku, query);
  }

  /** The only write endpoint. Rate-limited per client IP. */
  @Post()
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Write a review',
    description:
      'The only write endpoint. No login; rate-limited per client IP (default 5 per 10 minutes).',
  })
  @ApiCreatedResponse({ type: ReviewView })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiConflictResponse({
    description: 'The product is no longer sold (discontinued or delisted).',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit reached. Try again later.',
  })
  create(
    @Param('sku') sku: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewView> {
    return this.reviews.create(sku, dto);
  }
}
