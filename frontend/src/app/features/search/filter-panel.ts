import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FacetValue, ProductFacets } from '../../core/api.models';
import { FilterKey, SearchState } from './search-state';

interface FilterOption extends FacetValue {
  selected: boolean;
}

interface FilterGroup {
  key: FilterKey;
  label: string;
  hint?: string;
  options: FilterOption[];
}

const GROUPS: { key: FilterKey; label: string; hint?: string }[] = [
  { key: 'function', label: 'Function' },
  { key: 'applicationArea', label: 'Application area' },
  { key: 'region', label: 'Region', hint: 'Includes products available globally.' },
  { key: 'certifications', label: 'Certifications', hint: 'Products must have all selected.' },
];

/**
 * Builds the options for one filter group. Selected values are always listed,
 * even when the current results have none of them, so they can be unticked.
 */
export function buildOptions(facet: FacetValue[], selected: string[]): FilterOption[] {
  const options = facet.map((f) => ({ ...f, selected: selected.includes(f.value) }));
  for (const value of selected) {
    if (!options.some((o) => o.value === value)) {
      options.push({ value, count: 0, selected: true });
    }
  }
  return options.sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * Checkbox lists with result counts. The facets are short (5–9 values each), so
 * one tap per value beats a dropdown, especially on a phone.
 */
@Component({
  selector: 'app-filter-panel',
  imports: [FormsModule, Checkbox, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-panel.html',
  styleUrl: './filter-panel.scss',
})
export class FilterPanel {
  readonly facets = input<ProductFacets | undefined>();
  readonly state = input.required<SearchState>();
  /** Unique prefix for input ids (the panel can be rendered twice: sidebar and drawer). */
  readonly idPrefix = input('filter');
  readonly changed = output<Partial<SearchState>>();

  protected readonly groups = computed<FilterGroup[]>(() => {
    const facets = this.facets();
    const state = this.state();
    return GROUPS.map((g) => ({
      ...g,
      options: buildOptions(facets?.[g.key] ?? [], state[g.key]),
    }));
  });

  protected toggle(key: FilterKey, value: string, checked: boolean): void {
    const current = this.state()[key];
    const next = checked ? [...current, value] : current.filter((v) => v !== value);
    this.changed.emit({ [key]: next });
  }

  protected setIncludeDiscontinued(value: boolean): void {
    this.changed.emit({ includeDiscontinued: value });
  }

  protected optionId(key: string, value: string): string {
    return `${this.idPrefix()}-${key}-${value}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }
}
