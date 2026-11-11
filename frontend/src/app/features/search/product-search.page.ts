import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { describeHttpError } from '../../core/http-error';
import { ProductApiService } from '../../core/product-api.service';
import { shareLink } from '../../shared/share';
import { FilterPanel } from './filter-panel';
import { ProductCard } from './product-card';
import {
  activeFilterCount,
  FILTER_KEYS,
  FilterKey,
  fromQueryParams,
  hasCriteria,
  PAGE_SIZES,
  SearchState,
  SORT_OPTIONS,
  toQueryParams,
  updateState,
} from './search-state';

const SEARCH_DEBOUNCE_MS = 300;

interface ActiveChip {
  key: FilterKey | 'includeDiscontinued';
  value: string;
  label: string;
}

@Component({
  selector: 'app-product-search-page',
  imports: [
    FormsModule,
    Button,
    Drawer,
    IconField,
    InputIcon,
    InputText,
    Message,
    Paginator,
    Select,
    Skeleton,
    Toast,
    FilterPanel,
    ProductCard,
  ],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-search.page.html',
  styleUrl: './product-search.page.scss',
})
export class ProductSearchPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProductApiService);
  private readonly messages = inject(MessageService);

  /** Single source of truth: the URL. */
  protected readonly state = toSignal(this.route.queryParams.pipe(map(fromQueryParams)), {
    requireSync: true,
  });

  protected readonly results = rxResource({
    params: () => this.state(),
    stream: ({ params }) => this.api.search(params),
  });

  /** Keeps the previous results on screen while the next search loads (no flicker). */
  protected readonly shown = linkedSignal<
    ReturnType<typeof this.results.value>,
    ReturnType<typeof this.results.value>
  >({
    // hasValue() guard: reading value() of a failed resource throws.
    source: () => (this.results.hasValue() ? this.results.value() : undefined),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly searchText = linkedSignal(() => this.state().q);
  protected readonly filtersOpen = signal(false);
  protected readonly sortOptions = [...SORT_OPTIONS];
  protected readonly pageSizes = [...PAGE_SIZES];
  protected readonly filterCount = computed(() => activeFilterCount(this.state()));
  protected readonly hasCriteria = computed(() => hasCriteria(this.state()));
  protected readonly errorMessage = computed(() =>
    this.results.error() ? describeHttpError(this.results.error()) : null,
  );
  protected readonly skeletons = Array.from({ length: 6 }, (_, i) => i);

  protected readonly chips = computed<ActiveChip[]>(() => {
    const state = this.state();
    const chips: ActiveChip[] = FILTER_KEYS.flatMap((key) =>
      state[key].map((value) => ({ key, value, label: value })),
    );
    if (state.includeDiscontinued) {
      chips.push({ key: 'includeDiscontinued', value: 'true', label: 'Incl. discontinued' });
    }
    return chips;
  });

  private readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(
        map((q) => q.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      // replaceUrl: typing shouldn't fill the back button with one entry per keystroke.
      .subscribe((q) => this.update({ q }, true));
  }

  protected onType(value: string): void {
    this.searchText.set(value);
    this.typed.next(value);
  }

  protected clearSearch(): void {
    this.searchText.set('');
    this.update({ q: '' });
  }

  protected update(patch: Partial<SearchState>, replaceUrl = false): void {
    const next = updateState(this.state(), patch);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(next),
      replaceUrl,
    });
  }

  protected removeChip(chip: ActiveChip): void {
    if (chip.key === 'includeDiscontinued') {
      this.update({ includeDiscontinued: false });
    } else {
      this.update({ [chip.key]: this.state()[chip.key].filter((v) => v !== chip.value) });
    }
  }

  protected clearAll(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected onPage(event: PaginatorState): void {
    const pageSize = event.rows ?? this.state().pageSize;
    const page = Math.floor((event.first ?? 0) / pageSize) + 1;
    if (pageSize !== this.state().pageSize) {
      this.update({ pageSize });
    } else {
      this.update({ page });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected async share(): Promise<void> {
    const outcome = await shareLink('Product Finder search', window.location.href);
    if (outcome === 'copied') {
      this.messages.add({ severity: 'success', summary: 'Link copied', detail: 'Paste it to share exactly this view.' });
    } else if (outcome === 'failed') {
      this.messages.add({ severity: 'warn', summary: 'Could not copy the link', detail: window.location.href });
    }
  }
}
