import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Rating } from 'primeng/rating';
import { Review } from '../../core/api.models';

@Component({
  selector: 'app-review-list',
  imports: [DatePipe, FormsModule, Rating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="reviews">
      @for (review of reviews(); track review.id) {
        <li class="review">
          <div class="review__head">
            <p-rating [ngModel]="review.rating" [readonly]="true" [attr.aria-label]="review.rating + ' out of 5 stars'" />
            @if (review.title) {
              <h4 class="review__title">{{ review.title }}</h4>
            }
          </div>
          <!-- Rendered as text: user content is never interpreted as HTML. -->
          <p class="review__body">{{ review.body }}</p>
          <p class="review__meta">{{ review.authorName }} · <time [attr.datetime]="review.createdAt">{{ review.createdAt | date: 'mediumDate' }}</time></p>
        </li>
      }
    </ul>
  `,
  styles: `
    .reviews { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
    .review { padding-bottom: 1rem; border-bottom: 1px solid var(--pf-border); }
    .review__head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
    .review__title { margin: 0; font-size: 1rem; }
    .review__body { margin: 0.5rem 0; white-space: pre-line; overflow-wrap: anywhere; }
    .review__meta { margin: 0; font-size: 0.85rem; color: var(--pf-text-muted); }
  `,
})
export class ReviewList {
  readonly reviews = input.required<Review[]>();
}
