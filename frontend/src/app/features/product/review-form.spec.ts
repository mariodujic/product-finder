import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { Review } from '../../core/api.models';
import { ReviewForm } from './review-form';

describe('ReviewForm', () => {
  let fixture: ComponentFixture<ReviewForm>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const type = (selector: string, value: string) => {
    const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const rate = (stars: number) => {
    // Click the visible star, as a person does (not the hidden radio input).
    el.querySelectorAll<HTMLElement>('.p-rating-option')[stars - 1].click();
  };
  const submit = async () => {
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    fixture = TestBed.createComponent(ReviewForm);
    fixture.componentRef.setInput('sku', 'P-10002');
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('does not send an incomplete review and shows what is missing', async () => {
    type('#review-body', 'Too short');
    await submit();

    http.expectNone('/api/products/P-10002/reviews');
    const text = el.textContent ?? '';
    expect(text).toContain('Please choose 1 to 5 stars.');
    expect(text).toContain('Please enter at least 2 characters.');
    expect(text).toContain('Please write at least 10 characters.');
  });

  it('treats an unselected star rating as missing (clicking the chosen star clears it)', async () => {
    rate(3);
    rate(3);
    type('#review-author', 'Ana');
    type('#review-body', 'Works well in our cold-process line.');
    await submit();

    http.expectNone('/api/products/P-10002/reviews');
    expect(el.textContent).toContain('Please choose 1 to 5 stars.');
  });

  it('rejects whitespace-only text', async () => {
    rate(4);
    type('#review-author', '   ');
    type('#review-body', '              ');
    await submit();

    http.expectNone('/api/products/P-10002/reviews');
  });

  it('sends a trimmed review, then resets and notifies the page', async () => {
    const submitted: Review[] = [];
    fixture.componentInstance.submitted.subscribe((r) => submitted.push(r));

    rate(4);
    type('#review-author', '  Ana  ');
    type('#review-title', '   ');
    type('#review-body', '  Stable emulsion after 8 weeks.  ');
    await submit();

    const req = http.expectOne('/api/products/P-10002/reviews');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      rating: 4,
      authorName: 'Ana',
      title: undefined,
      body: 'Stable emulsion after 8 weeks.',
      website: '',
    });
    const created: Review = {
      id: 1,
      rating: 4,
      authorName: 'Ana',
      title: null,
      body: 'Stable emulsion after 8 weeks.',
      createdAt: '2026-11-11T10:00:00Z',
    };
    req.flush(created);
    await fixture.whenStable();

    expect(submitted).toEqual([created]);
    expect(el.querySelector<HTMLTextAreaElement>('#review-body')!.value).toBe('');
  });

  it('explains a rate-limit rejection in plain words and keeps the text', async () => {
    rate(5);
    type('#review-author', 'Ana');
    type('#review-body', 'Works well in our cold-process line.');
    await submit();

    http
      .expectOne('/api/products/P-10002/reviews')
      .flush({ message: 'Too Many Requests' }, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();

    expect(el.textContent).toContain("You've sent several reviews in a short time.");
    expect(el.querySelector<HTMLTextAreaElement>('#review-body')!.value).toBe(
      'Works well in our cold-process line.',
    );
  });

  it('hides the honeypot field from people and assistive technology', () => {
    const honeypot = el.querySelector('#review-website')!;
    expect(honeypot.getAttribute('tabindex')).toBe('-1');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
