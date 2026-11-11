import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductSummary } from '../../core/api.models';
import { StatusTag } from '../../shared/status-tag';

const MAX_VISIBLE_CERTIFICATIONS = 3;

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  readonly product = input.required<ProductSummary>();

  protected readonly visibleCertifications = computed(() =>
    this.product().certifications.slice(0, MAX_VISIBLE_CERTIFICATIONS),
  );
  protected readonly hiddenCertificationCount = computed(() =>
    Math.max(0, this.product().certifications.length - MAX_VISIBLE_CERTIFICATIONS),
  );
}
