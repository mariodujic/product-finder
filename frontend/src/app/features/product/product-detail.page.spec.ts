import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { providePrimeNG } from 'primeng/config';
import { ProductDetail, ReviewPage } from '../../core/api.models';
import { ProductDetailPage } from './product-detail.page';

const product: ProductDetail = {
  sku: 'P-10007',
  name: 'Novarel PR 590',
  chemicalName: 'Sodium Benzoate',
  function: 'Preservative',
  applicationArea: 'Personal Care',
  region: 'Global',
  certifications: ['Kosher'],
  status: 'ACTIVE',
  launchYear: null,
  rating: { average: 4, count: 1 },
  description: 'Preservative based on Sodium Benzoate.',
  isListed: true,
};
const reviews: ReviewPage = {
  items: [
    {
      id: 1,
      authorName: 'Ana',
      rating: 4,
      title: null,
      body: '<b>Good</b>',
      createdAt: '2026-11-01T10:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

describe('ProductDetailPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products/:sku', component: ProductDetailPage }], withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const open = async (p: ProductDetail | null, status = 200) => {
    await harness.navigateByUrl(`/products/${p?.sku ?? 'P-99999'}`);
    const productReq = http.expectOne((r) => r.url.startsWith('/api/products/P-') && !r.url.endsWith('/reviews'));
    if (p) productReq.flush(p);
    else productReq.flush({ message: 'Not found' }, { status, statusText: 'Not Found' });
    const reviewsReq = http.expectOne((r) => r.url.endsWith('/reviews'));
    if (p) reviewsReq.flush(reviews);
    else reviewsReq.flush({ message: 'Not found' }, { status, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    return (harness.routeNativeElement as HTMLElement);
  };

  it('shows the data sheet, reviews and the review form for an active product', async () => {
    const el = await open(product);
    const text = el.textContent ?? '';
    expect(text).toContain('Novarel PR 590');
    expect(text).toContain('Sodium Benzoate');
    expect(text).toContain('Unknown'); // missing launch year
    expect(text).toContain('1 review');
    expect(el.querySelector('app-review-form')).not.toBeNull();
  });

  it('renders review text as text, never as HTML', async () => {
    const el = await open(product);
    expect(el.querySelector('.review__body')!.textContent).toBe('<b>Good</b>');
    expect(el.querySelector('.review__body b')).toBeNull();
  });

  it('warns about a discontinued product and closes new reviews', async () => {
    const el = await open({ ...product, status: 'DISCONTINUED' });
    const text = el.textContent ?? '';
    expect(text).toContain('has been discontinued');
    expect(text).toContain('New reviews are closed');
    expect(el.querySelector('app-review-form')).toBeNull();
  });

  it('explains a product that left the catalogue (old shared link)', async () => {
    const el = await open({ ...product, isListed: false });
    expect(el.textContent).toContain('no longer in our catalogue');
    expect(el.textContent).toContain('No longer offered');
  });

  it('shows "not found" for an unknown SKU instead of failing', async () => {
    const el = await open(null, 404);
    expect(el.textContent).toContain('Product not found');
    expect(el.textContent).toContain('P-99999');
  });
});
