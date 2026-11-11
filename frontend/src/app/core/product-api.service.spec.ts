import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SEARCH_STATE } from '../features/search/search-state';
import { describeHttpError } from './http-error';
import { ProductApiService } from './product-api.service';

describe('ProductApiService', () => {
  let api: ProductApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProductApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the search state as repeated query params (same as the page URL)', () => {
    api
      .search({
        ...DEFAULT_SEARCH_STATE,
        q: 'sulfate',
        region: ['EMEA', 'Global'],
        includeDiscontinued: true,
        page: 2,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/api/products');
    expect(req.request.urlWithParams).toBe(
      '/api/products?q=sulfate&region=EMEA&region=Global&includeDiscontinued=true&page=2',
    );
  });

  it('encodes the SKU in product URLs', () => {
    api.product('P 1/2').subscribe();
    http.expectOne('/api/products/P%201%2F2');
  });
});

describe('describeHttpError', () => {
  const error = (status: number, body: unknown = null) =>
    new HttpErrorResponse({ status, error: body });

  it.each([
    [0, "Can't reach the server"],
    [404, 'could not be found'],
    [429, 'several reviews in a short time'],
    [500, 'Something went wrong on our side'],
  ])('explains status %s', (status, text) => {
    expect(describeHttpError(error(status))).toContain(text);
  });

  it('passes on the server explanation for 409', () => {
    expect(describeHttpError(error(409, { message: 'This product is no longer sold' }))).toBe(
      'This product is no longer sold',
    );
  });

  it('lists validation problems for 400', () => {
    expect(describeHttpError(error(400, { message: ['rating must not be greater than 5'] }))).toBe(
      'Please check your input: rating must not be greater than 5.',
    );
  });
});
