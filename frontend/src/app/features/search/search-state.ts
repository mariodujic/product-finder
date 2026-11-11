import { Params } from '@angular/router';

export const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: '-launchYear', label: 'Newest launch' },
  { value: 'launchYear', label: 'Oldest launch' },
  { value: '-rating', label: 'Best rated' },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

export const PAGE_SIZES = [20, 50, 100] as const;

export const FILTER_KEYS = ['function', 'applicationArea', 'region', 'certifications'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/**
 * Everything that defines "what I'm looking at". It lives entirely in the URL,
 * so a copied link reproduces the exact view.
 */
export interface SearchState {
  q: string;
  function: string[];
  applicationArea: string[];
  region: string[];
  certifications: string[];
  includeDiscontinued: boolean;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export const DEFAULT_SEARCH_STATE: SearchState = {
  q: '',
  function: [],
  applicationArea: [],
  region: [],
  certifications: [],
  includeDiscontinued: false,
  sort: 'name',
  page: 1,
  pageSize: 20,
};

const asArray = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(String).map((v) => v.trim()).filter(Boolean))];
};

const asPositiveInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * URL → state. Tolerant: a hand-edited or outdated link falls back to defaults
 * instead of breaking the page.
 */
export function fromQueryParams(params: Params): SearchState {
  const sort = SORT_OPTIONS.find((o) => o.value === params['sort'])?.value;
  const pageSize = Number(params['pageSize']);
  return {
    q: typeof params['q'] === 'string' ? params['q'].trim() : '',
    function: asArray(params['function']),
    applicationArea: asArray(params['applicationArea']),
    region: asArray(params['region']),
    certifications: asArray(params['certifications']),
    includeDiscontinued: params['includeDiscontinued'] === 'true',
    sort: sort ?? DEFAULT_SEARCH_STATE.sort,
    page: asPositiveInt(params['page'], 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_SEARCH_STATE.pageSize,
  };
}

/**
 * State → URL (and API) query params. Default values are left out, so links
 * stay short and readable.
 */
export function toQueryParams(state: SearchState): Params {
  const params: Params = {};
  if (state.q) params['q'] = state.q;
  for (const key of FILTER_KEYS) {
    if (state[key].length) params[key] = state[key];
  }
  if (state.includeDiscontinued) params['includeDiscontinued'] = 'true';
  if (state.sort !== DEFAULT_SEARCH_STATE.sort) params['sort'] = state.sort;
  if (state.page !== 1) params['page'] = String(state.page);
  if (state.pageSize !== DEFAULT_SEARCH_STATE.pageSize) params['pageSize'] = String(state.pageSize);
  return params;
}

/** Applies a change. Any change other than paging starts again at page 1. */
export function updateState(state: SearchState, patch: Partial<SearchState>): SearchState {
  const next = { ...state, ...patch };
  if (patch.page === undefined) next.page = 1;
  return next;
}

export function activeFilterCount(state: SearchState): number {
  return (
    FILTER_KEYS.reduce((sum, key) => sum + state[key].length, 0) +
    (state.includeDiscontinued ? 1 : 0)
  );
}

export function hasCriteria(state: SearchState): boolean {
  return state.q !== '' || activeFilterCount(state) > 0;
}
