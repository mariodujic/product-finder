import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { ProductFacets } from '../../core/api.models';
import { buildOptions, FilterPanel } from './filter-panel';
import { DEFAULT_SEARCH_STATE, SearchState } from './search-state';

describe('buildOptions', () => {
  it('marks selected values and sorts alphabetically', () => {
    const options = buildOptions(
      [
        { value: 'Global', count: 10 },
        { value: 'EMEA', count: 4 },
      ],
      ['EMEA'],
    );
    expect(options).toEqual([
      { value: 'EMEA', count: 4, selected: true },
      { value: 'Global', count: 10, selected: false },
    ]);
  });

  it('keeps a selected value visible even when it has no results, so it can be unticked', () => {
    expect(buildOptions([], ['Vegan'])).toEqual([{ value: 'Vegan', count: 0, selected: true }]);
  });
});

describe('FilterPanel', () => {
  let fixture: ComponentFixture<FilterPanel>;
  const facets: ProductFacets = {
    function: [{ value: 'Surfactant', count: 3 }],
    applicationArea: [],
    region: [
      { value: 'EMEA', count: 5 },
      { value: 'Global', count: 9 },
    ],
    certifications: [{ value: 'Vegan', count: 0 }],
  };

  const render = async (state: SearchState) => {
    fixture.componentRef.setInput('facets', facets);
    fixture.componentRef.setInput('state', state);
    await fixture.whenStable();
  };
  const checkbox = (id: string) =>
    fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [providePrimeNG()] });
    fixture = TestBed.createComponent(FilterPanel);
  });

  it('emits the new selection when a value is ticked', async () => {
    await render({ ...DEFAULT_SEARCH_STATE, region: ['EMEA'] });
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((c) => emitted.push(c));

    checkbox('filter-region-Global').click();

    expect(emitted).toEqual([{ region: ['EMEA', 'Global'] }]);
  });

  it('emits the remaining selection when a value is unticked', async () => {
    await render({ ...DEFAULT_SEARCH_STATE, region: ['EMEA', 'Global'] });
    const emitted: unknown[] = [];
    fixture.componentInstance.changed.subscribe((c) => emitted.push(c));

    checkbox('filter-region-EMEA').click();

    expect(emitted).toEqual([{ region: ['Global'] }]);
  });

  it('disables values that would lead to no results', async () => {
    await render(DEFAULT_SEARCH_STATE);
    expect(checkbox('filter-certifications-Vegan').disabled).toBe(true);
    expect(checkbox('filter-function-Surfactant').disabled).toBe(false);
  });

  it('explains the region and certification rules', async () => {
    await render(DEFAULT_SEARCH_STATE);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Includes products available globally.');
    expect(text).toContain('Products must have all selected.');
  });
});
