import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { ProductStatus } from '../core/api.models';

type Severity = 'success' | 'warn' | 'danger' | 'secondary';

interface StatusView {
  label: string;
  severity: Severity;
  icon: string;
}

/** Lifecycle status, always as text plus colour plus icon (never colour alone). */
export function statusView(status: ProductStatus, isListed = true): StatusView {
  if (!isListed) {
    return { label: 'No longer offered', severity: 'secondary', icon: 'pi pi-ban' };
  }
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', severity: 'success', icon: 'pi pi-check-circle' };
    case 'PHASE_OUT':
      return { label: 'Phase-out', severity: 'warn', icon: 'pi pi-clock' };
    case 'DISCONTINUED':
      return { label: 'Discontinued', severity: 'danger', icon: 'pi pi-times-circle' };
  }
}

@Component({
  selector: 'app-status-tag',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-tag [value]="view().label" [severity]="view().severity" [icon]="view().icon" />`,
})
export class StatusTag {
  readonly status = input.required<ProductStatus>();
  readonly isListed = input(true);
  protected readonly view = computed(() => statusView(this.status(), this.isListed()));
}
