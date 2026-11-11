import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Rating } from 'primeng/rating';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { ProductDetail } from '../../core/api.models';
import { describeHttpError } from '../../core/http-error';
import { ProductApiService } from '../../core/product-api.service';
import { shareLink } from '../../shared/share';
import { StatusTag } from '../../shared/status-tag';
import { ReviewForm } from './review-form';
import { ReviewList } from './review-list';

const REVIEWS_PER_PAGE = 10;

interface Notice {
  severity: 'warn' | 'error' | 'secondary';
  text: string;
}

/** Banner explaining why a product may not be the right choice any more. */
export function lifecycleNotice(product: ProductDetail): Notice | null {
  if (!product.isListed) {
    return {
      severity: 'secondary',
      text: 'This product is no longer in our catalogue. Please contact your sales representative for a current alternative.',
    };
  }
  if (product.status === 'DISCONTINUED') {
    return {
      severity: 'error',
      text: 'This product has been discontinued and is no longer available. Please contact your sales representative for an alternative.',
    };
  }
  if (product.status === 'PHASE_OUT') {
    return {
      severity: 'warn',
      text: 'This product is being phased out. It is still available for now, but consider a successor for new developments.',
    };
  }
  return null;
}

@Component({
  selector: 'app-product-detail-page',
  imports: [
    FormsModule,
    RouterLink,
    Button,
    Message,
    Paginator,
    Rating,
    Skeleton,
    Toast,
    StatusTag,
    ReviewForm,
    ReviewList,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  private readonly api = inject(ProductApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly title = inject(Title);

  /** Bound from the route parameter (/products/:sku). */
  readonly sku = input.required<string>();

  protected readonly product = rxResource({
    params: () => this.sku(),
    stream: ({ params }) => this.api.product(params),
  });

  protected readonly reviewPage = signal(1);
  protected readonly reviews = rxResource({
    params: () => ({ sku: this.sku(), page: this.reviewPage() }),
    stream: ({ params }) => this.api.reviews(params.sku, params.page, REVIEWS_PER_PAGE),
  });

  /** Safe reads: value() of a failed resource throws, so guard with hasValue(). */
  protected readonly current = computed(() =>
    this.product.hasValue() ? this.product.value() : undefined,
  );
  protected readonly reviewData = computed(() =>
    this.reviews.hasValue() ? this.reviews.value() : undefined,
  );

  protected readonly notFound = computed(() => {
    const error = this.product.error();
    return error instanceof HttpErrorResponse && error.status === 404;
  });
  protected readonly errorMessage = computed(() =>
    this.product.error() ? describeHttpError(this.product.error()) : null,
  );
  protected readonly notice = computed(() => {
    const p = this.current();
    return p ? lifecycleNotice(p) : null;
  });
  protected readonly canReview = computed(() => {
    const p = this.current();
    return !!p && p.isListed && p.status !== 'DISCONTINUED';
  });
  protected readonly reviewsPerPage = REVIEWS_PER_PAGE;

  constructor() {
    effect(() => {
      const p = this.current();
      this.title.setTitle(p ? `${p.name} (${p.sku}) · Product Finder` : 'Product Finder');
    });
  }

  /** Back to the exact search the user came from, or to the catalogue for a shared link. */
  protected back(): void {
    const navigationId = (history.state as { navigationId?: number } | null)?.navigationId ?? 1;
    if (navigationId > 1) {
      history.back();
    } else {
      void this.router.navigate(['/products']);
    }
  }

  protected onReviewPage(event: PaginatorState): void {
    this.reviewPage.set((event.page ?? 0) + 1);
  }

  protected onReviewSubmitted(): void {
    this.messages.add({ severity: 'success', summary: 'Thank you!', detail: 'Your review has been published.' });
    this.product.reload();
    this.reviewPage.set(1);
    this.reviews.reload();
  }

  protected async share(): Promise<void> {
    const p = this.current();
    const outcome = await shareLink(p ? `${p.name} (${p.sku})` : 'Product', window.location.href);
    if (outcome === 'copied') {
      this.messages.add({ severity: 'success', summary: 'Link copied', detail: 'Send it to a colleague to discuss this product.' });
    } else if (outcome === 'failed') {
      this.messages.add({ severity: 'warn', summary: 'Could not copy the link', detail: window.location.href });
    }
  }
}
