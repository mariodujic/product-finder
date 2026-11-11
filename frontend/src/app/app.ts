import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="header">
      <div class="container header__inner">
        <a class="brand" routerLink="/products" aria-label="Product Finder home">
          <span class="brand__mark" aria-hidden="true">PF</span>
          <span class="brand__name">Product Finder</span>
        </a>
        <span class="header__tagline">Specialty chemicals catalogue</span>
      </div>
    </header>
    <main id="main" class="container main" tabindex="-1">
      <router-outlet />
    </main>
    <footer class="footer">
      <div class="container">Product data is updated nightly from our product information system.</div>
    </footer>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    .skip-link { position: absolute; left: -10000px; top: 0; z-index: 100; padding: 0.5rem 1rem; background: var(--pf-surface); }
    .skip-link:focus { left: 1rem; }
    .header { position: sticky; top: 0; z-index: 10; background: var(--pf-primary); color: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 0.15); }
    .header__inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: var(--pf-header-height); }
    .header__tagline { font-size: 0.85rem; opacity: 0.85; }
    @media (max-width: 480px) { .header__tagline { display: none; } }
    .brand { display: inline-flex; align-items: center; gap: 0.6rem; color: #fff; text-decoration: none; font-weight: 700; font-size: 1.1rem; }
    .brand__mark { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 6px; background: var(--pf-accent); font-size: 0.8rem; letter-spacing: 0.02em; }
    .main { flex: 1; padding-bottom: 3rem; outline: none; }
    .footer { padding: 1.5rem 0; border-top: 1px solid var(--pf-border); font-size: 0.85rem; color: var(--pf-text-muted); background: var(--pf-surface); }
  `,
})
export class App {}
