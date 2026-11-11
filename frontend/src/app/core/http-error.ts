import { HttpErrorResponse } from '@angular/common/http';

/** Turns an API error into a sentence a customer can act on. */
export function describeHttpError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Please try again.';
  }
  const serverMessage = (error.error as { message?: unknown } | null)?.message;
  switch (error.status) {
    case 0:
      return "Can't reach the server. Please check your connection and try again.";
    case 404:
      return 'This product could not be found.';
    case 409:
      return typeof serverMessage === 'string'
        ? serverMessage
        : 'This action is no longer possible for this product.';
    case 429:
      return "You've sent several reviews in a short time. Please try again in a few minutes.";
    case 400:
      return Array.isArray(serverMessage)
        ? `Please check your input: ${serverMessage.join('; ')}.`
        : 'Please check your input.';
    default:
      return 'Something went wrong on our side. Please try again later.';
  }
}
