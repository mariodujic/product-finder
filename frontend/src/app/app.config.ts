import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { ProductFinderPreset } from './theme/product-finder.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Route params (e.g. :sku) arrive as component inputs.
      withComponentInputBinding(),
      // Back button returns to the same scroll position in the result list.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withFetch()),
    providePrimeNG({
      theme: {
        preset: ProductFinderPreset,
        // Light only in v1: the selector is never applied.
        options: { darkModeSelector: '.pf-dark' },
      },
    }),
  ],
};
