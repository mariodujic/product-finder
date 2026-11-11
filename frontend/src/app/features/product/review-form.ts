import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Rating } from 'primeng/rating';
import { Textarea } from 'primeng/textarea';
import { Review } from '../../core/api.models';
import { describeHttpError } from '../../core/http-error';
import { ProductApiService } from '../../core/product-api.service';

/** Rejects input that is only whitespace (the API trims before validating). */
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/** Same limits as the API (backend/src/reviews/dto/create-review.dto.ts). */
export const REVIEW_LIMITS = {
  authorMin: 2,
  authorMax: 80,
  titleMax: 120,
  bodyMin: 10,
  bodyMax: 2000,
} as const;

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule, Button, InputText, Message, Rating, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-form.html',
  styleUrl: './review-form.scss',
})
export class ReviewForm {
  private readonly api = inject(ProductApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly sku = input.required<string>();
  readonly submitted = output<Review>();

  protected readonly limits = REVIEW_LIMITS;
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    // `required` matters: PrimeNG's rating becomes null when the selected star is
    // clicked again, and `min` alone lets null through.
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    authorName: [
      '',
      [notBlank, Validators.minLength(REVIEW_LIMITS.authorMin), Validators.maxLength(REVIEW_LIMITS.authorMax)],
    ],
    title: ['', [Validators.maxLength(REVIEW_LIMITS.titleMax)]],
    body: [
      '',
      [notBlank, Validators.minLength(REVIEW_LIMITS.bodyMin), Validators.maxLength(REVIEW_LIMITS.bodyMax)],
    ],
    /** Honeypot: hidden from people, filled in by naive bots. */
    website: [''],
  });

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.api
      .createReview(this.sku(), {
        rating: value.rating,
        authorName: value.authorName.trim(),
        title: value.title.trim() || undefined,
        body: value.body.trim(),
        website: value.website,
      })
      .subscribe({
        next: (review) => {
          this.submitting.set(false);
          this.form.reset();
          this.submitted.emit(review);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.serverError.set(describeHttpError(err));
        },
      });
  }
}
