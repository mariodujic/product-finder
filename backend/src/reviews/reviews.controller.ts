import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { ReviewPage, ReviewView } from './review.types';
import { ReviewsService } from './reviews.service';

@Controller('products/:sku/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(
    @Param('sku') sku: string,
    @Query() query: ReviewQueryDto,
  ): Promise<ReviewPage> {
    return this.reviews.list(sku, query);
  }

  /** The only write endpoint. Rate-limited per client IP. */
  @Post()
  @UseGuards(ThrottlerGuard)
  create(
    @Param('sku') sku: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewView> {
    return this.reviews.create(sku, dto);
  }
}
