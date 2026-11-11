import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    title: 'Find products · Product Finder',
    loadComponent: () =>
      import('./features/search/product-search.page').then((m) => m.ProductSearchPage),
  },
  {
    // The detail page sets its own title once the product has loaded.
    path: 'products/:sku',
    loadComponent: () =>
      import('./features/product/product-detail.page').then((m) => m.ProductDetailPage),
  },
  {
    path: '**',
    title: 'Page not found · Product Finder',
    loadComponent: () => import('./shared/not-found.page').then((m) => m.NotFoundPage),
  },
];
