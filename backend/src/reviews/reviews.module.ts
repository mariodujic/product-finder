import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const envInt = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

@Module({
  imports: [
    // Read at startup (not import time) so tests and deployments can tune it via env.
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: 'reviews',
          ttl: envInt('REVIEW_RATE_WINDOW_SECONDS', 600) * 1000,
          limit: envInt('REVIEW_RATE_LIMIT', 5),
        },
      ],
    }),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
