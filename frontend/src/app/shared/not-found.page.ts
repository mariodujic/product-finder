import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="state">
      <h1>Page not found</h1>
      <p>The link may be outdated. You can search the catalogue instead.</p>
      <p-button label="Search the catalogue" routerLink="/products" />
    </section>
  `,
  styles: `.state { padding: 3rem 1rem; text-align: center; }`,
})
export class NotFoundPage {}
