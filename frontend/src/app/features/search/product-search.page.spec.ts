import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { providePrimeNG } from 'primeng/config';
import { filter, firstValueFrom } from 'rxjs';
import { ProductSearchResult } from '../../core/api.models';
import { ProductSearchPage } from './product-search.page';

const result: ProductSearchResult = {
  items: [
    {
      sku: 'P-10003',
      name: 'Velumin EF 650',
      chemicalName: 'Mono- and Diglycerides',
      function: 'Emulsifier',
      applicationArea: 'Food & Nutrition',
      region: 'EMEA',
      certifications: ['Kosher', 'RSPO Mass Balance', 'Readily Biodegradable', 'Vegan'],
      status: 'PHASE_OUT',
      launchYear: 2016,
      rating: { average: 4.5, count: 2 },
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  facets: {
    function: [{ value: 'Emulsifier', count: 1 }],
    applicationArea: [{ value: 'Food & Nutrition', count: 1 }],
    region: [{ value: 'EMEA', count: 1 }],
    certifications: [{ value: 'Kosher', count: 1 }],
  },
};

describe('ProductSearchPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products', component: ProductSearchPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  it('turns a shared link into the same API query and renders the results', async () => {
    await harness.navigateByUrl('/products?q=glycerides&region=EMEA&certifications=Kosher');

    const req = http.expectOne((r) => r.url === '/api/products');
    expect(req.request.urlWithParams).toBe(
      '/api/products?q=glycerides&region=EMEA&certifications=Kosher',
    );
    req.flush(result);
    await harness.fixture.whenStable();

    expect(text()).toContain('1 product');
    expect(text()).toContain('Velumin EF 650');
    expect(text()).toContain('Phase-out');
    expect(text()).toContain('+1 more'); // 4 certifications, 3 shown
    const link = harness.routeNativeElement!.querySelector('a.card')!;
    expect(link.getAttribute('href')).toBe('/products/P-10003');
  });

  it('removes a filter via its chip and updates the URL', async () => {
    await harness.navigateByUrl('/products?region=EMEA&certifications=Kosher&page=3');
    http.expectOne((r) => r.url === '/api/products').flush(result);
    await harness.fixture.whenStable();

    const chip = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove filter EMEA"]',
    )!;
    const navigated = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    chip.click();
    await navigated;

    // Removing a filter also resets paging to page 1.
    expect(router.url).toBe('/products?certifications=Kosher');
    TestBed.tick(); // let the resource react to the new URL
    http.expectOne('/api/products?certifications=Kosher').flush(result);
    await harness.fixture.whenStable();
  });

  it('offers a way out when nothing matches', async () => {
    await harness.navigateByUrl('/products?q=nothing');
    http.expectOne((r) => r.url === '/api/products').flush({ ...result, items: [], total: 0 });
    await harness.fixture.whenStable();

    expect(text()).toContain('No products match');
    expect(text()).toContain('Clear search and filters');
  });

  it('shows a retry option when the API is unreachable', async () => {
    await harness.navigateByUrl('/products');
    http
      .expectOne((r) => r.url === '/api/products')
      .error(new ProgressEvent('error'), { status: 0 });
    await harness.fixture.whenStable();

    expect(text()).toContain("Can't reach the server");
    expect(text()).toContain('Try again');
  });
});
