import {
  activeFilterCount,
  DEFAULT_SEARCH_STATE,
  fromQueryParams,
  hasCriteria,
  SearchState,
  toQueryParams,
  updateState,
} from './search-state';

describe('search state ↔ URL', () => {
  const full: SearchState = {
    q: 'polysorbate',
    function: ['Emulsifier', 'Surfactant'],
    applicationArea: ['Personal Care'],
    region: ['EMEA'],
    certifications: ['Vegan', 'Halal'],
    includeDiscontinued: true,
    sort: '-rating',
    page: 3,
    pageSize: 50,
  };

  it('round-trips every field, so a shared link reproduces the exact view', () => {
    expect(fromQueryParams(toQueryParams(full))).toEqual(full);
  });

  it('keeps links short by leaving out default values', () => {
    expect(toQueryParams(DEFAULT_SEARCH_STATE)).toEqual({});
    expect(toQueryParams({ ...DEFAULT_SEARCH_STATE, region: ['EMEA'] })).toEqual({
      region: ['EMEA'],
    });
  });

  it('reads a single value and repeated values as lists', () => {
    expect(fromQueryParams({ region: 'EMEA' }).region).toEqual(['EMEA']);
    expect(fromQueryParams({ region: ['EMEA', 'Global'] }).region).toEqual(['EMEA', 'Global']);
  });

  it('falls back to defaults for hand-edited or outdated links', () => {
    expect(
      fromQueryParams({
        sort: 'price',
        page: '-2',
        pageSize: '7',
        includeDiscontinued: 'yes',
        region: ['', ' EMEA ', 'EMEA'],
      }),
    ).toEqual({ ...DEFAULT_SEARCH_STATE, region: ['EMEA'] });
  });

  it('trims the search text', () => {
    expect(fromQueryParams({ q: '  lauret  ' }).q).toBe('lauret');
  });
});

describe('updateState', () => {
  const onPage4 = { ...DEFAULT_SEARCH_STATE, page: 4 };

  it('goes back to page 1 when the search changes', () => {
    expect(updateState(onPage4, { region: ['EMEA'] }).page).toBe(1);
    expect(updateState(onPage4, { sort: '-name' }).page).toBe(1);
  });

  it('keeps the requested page when paging', () => {
    expect(updateState(onPage4, { page: 5 }).page).toBe(5);
  });
});

describe('filter summaries', () => {
  it('counts every selected value plus the discontinued toggle', () => {
    const state = {
      ...DEFAULT_SEARCH_STATE,
      function: ['A', 'B'],
      certifications: ['Vegan'],
      includeDiscontinued: true,
    };
    expect(activeFilterCount(state)).toBe(4);
  });

  it('knows whether the user narrowed the search at all', () => {
    expect(hasCriteria(DEFAULT_SEARCH_STATE)).toBe(false);
    expect(hasCriteria({ ...DEFAULT_SEARCH_STATE, q: 'x' })).toBe(true);
    expect(hasCriteria({ ...DEFAULT_SEARCH_STATE, sort: '-rating' })).toBe(false);
  });
});
