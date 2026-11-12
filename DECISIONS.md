# Decisions

## Architecture

```
browser ──► web (nginx, Angular SPA) ──/api──► api (NestJS) ──► PostgreSQL 18 (Prisma)
                                                    ▲
             migrate (one-shot): migrations → PIM import → demo reviews
```

- **backend/** (NestJS): `ProductsModule` (search, facets, detail), `ReviewsModule` (the only write flow), `ImportModule` (PIM import as a CLI command), `PrismaModule`.
- **frontend/** (Angular, standalone components and signals, PrimeNG, SCSS). It has two routes: `/products` (search) and `/products/:sku` (data sheet and reviews).
- **docker-compose.yml** starts `db`, then `migrate` (runs once and exits), then `api`, then `web`. One command brings up a working system from an empty database.
- **API contract:** OpenAPI docs are generated from the same DTOs that validate requests, so they can't drift from the validation rules. They're served at `/api/docs`, and an end-to-end test checks that every route and search parameter is documented.

The product data belongs to the PIM. The API never writes product master data; only the import does. Reviews are the only data that users create.

## Key decisions

### 1. The import is the core of the system
`data/products.csv` is an *unmodified* PIM export, and it is dirty: duplicate SKUs, inconsistent status spellings, stray whitespace, a missing name, `n/a` launch years and quoted commas. So I built the import as a pipeline of pure functions (parse, normalise, dedupe, plan) followed by one step that writes to the database. Every rule can be unit-tested without a database.

| Data problem | Handling |
|---|---|
| Identical duplicate rows (`P-10013`) | Imported once, with a warning |
| Conflicting duplicate rows (`P-10151`, Active vs Discontinued) | **SKU skipped and reported; existing data kept.** I considered "last row wins", but guessing a lifecycle status is exactly the "customers ask about products we no longer sell" problem. The PIM owner has to fix it. |
| `active`, `ACTIVE`, `Phase out` | Mapped to `ACTIVE` / `PHASE_OUT` / `DISCONTINUED`. An unknown status means the row is skipped. |
| Whitespace in values | Every field is trimmed |
| Missing name (`P-10119`) | Row skipped and reported. A product without a name can't be shown. |
| Launch year empty or `n/a` | Stored as unknown. An optional field is no reason to drop a product. |
| Quoted commas and escaped quotes | Parsed with a real CSV parser (`csv-parse`) |

**Re-runnable and safe:**
- Products are matched by SKU. A content hash means unchanged rows aren't written, so a second run reports `0 inserted, 198 unchanged`.
- Products are **never hard-deleted**. A SKU missing from the export is marked *not listed*: it's hidden from search, but its page, shared links and reviews keep working. If it comes back, it's relisted. Reviews reference products with `ON DELETE RESTRICT`, so a reviewed product can't be deleted by accident.
- A SKU whose row was rejected tonight is not delisted. A bad row is a data problem, not a sign the product was withdrawn.
- **Truncation guard:** if an export would delist more than 20% of the listed catalogue, the import aborts and changes nothing (`--force` overrides it).
- The whole import runs in one transaction under a Postgres advisory lock, so a nightly job and a manual run can't overlap. Inserts are batched in chunks of 1,000.
- Every run is recorded in `import_runs` with its counts and row-level issues. That is the audit trail a product manager would use to fix the PIM data.

Docker Compose runs the import on every start. In production the same CLI command would run as a nightly job.

### 2. Product status is a business rule, not just a label
Sales colleagues are tired of questions about products that are no longer sold, so:
- Search hides discontinued and delisted products by default. A toggle shows discontinued ones.
- Detail pages still open for every product, with a clear banner (Phase-out, Discontinued, No longer offered) instead of a 404, because old shared links must keep working.
- Reviews on products that are no longer sold can be read but not written (the API returns `409`).

### 3. Search and filtering on the server, sized for 50,000 products
Nothing loads the whole catalogue into the browser. Search, filters, filter counts, sorting and paging all run in PostgreSQL:
- Free text is matched against name, chemical name, SKU and description. Each word must match. `pg_trgm` GIN indexes keep substring search index-backed. **Alternative considered:** Elasticsearch or OpenSearch. That's more infrastructure than 50k rows needs, and it's the step to take if relevance ranking or typo tolerance become requirements.
- Filters are combined with OR within a group and AND across groups. Certifications are AND: a buyer who needs Vegan *and* Halal needs both. They're stored as a `text[]` with a GIN index.
- Each filter group's counts ignore that group's own selection, so the counts show what you'd get by changing your choice.
- The average rating and review count are stored on the product and updated in the same transaction as each new review, with the product row locked. Sorting by rating is then a plain indexed column, not an aggregate over reviews.
- Every sort ends with a unique key (`sku`), so paging is stable.

### 4. The URL holds the entire search state
"Send a colleague a link to exactly what I'm looking at" means the search text, filters, sorting and page all live in the query string. Default values are left out to keep links short. Products have a stable address based on their SKU (`/products/P-10002`). The share button opens the phone's native share sheet and falls back to copying the link on desktop.

### 5. Mobile first, for trade fairs
Results are cards, not wide tables. On small screens the filters move into a bottom drawer. The UI looks like a factual technical catalogue rather than a consumer shop, because the users are formulators and buyers. Status is shown with a text label and an icon, never by colour alone.

### 6. Public reviews without login
This is the only write flow and the main abuse risk. The defences are:
- Strict validation on both the client and the server (rating 1–5, also a database `CHECK` constraint; name 2–80 characters; body 10–2000 characters), with unknown fields rejected.
- Rate limiting at 5 reviews per 10 minutes per client IP. `trust proxy` is set to exactly one hop (nginx), so a forged `X-Forwarded-For` header can't get around it.
- A honeypot field to catch naive spam bots.
- Reviews are stored and rendered as plain text, and Angular escapes all output.

### 7. Angular 21 + PrimeNG 21 instead of Angular 22
Angular 22 is the latest stable release, but PrimeNG 22, the only line that supports Angular 22, is commercially licensed: without a licence key it shows a watermark, and a large company doesn't qualify for the free tier. PrimeNG 21 and earlier are MIT-licensed, and Angular 21 has long-term support until about May 2027. I chose not to bring a licensing decision into a prototype. Upgrading is a business call: buy the licence or move to another component library.

## Assumptions
- **Region filter:** filtering by a region also includes products marked *Global*.
- **The SKU never changes** and is the product's public identifier.
- **The export is a full snapshot**, not a delta, so a missing SKU means the product is no longer listed.
- **English only** for v1.
- **Demo reviews** are seeded for the demo and labelled "(demo)". They follow the same insert-if-missing rule as the catalogue, and setting `SEED_DEMO_REVIEWS=false` turns them off.

## Risks and how they're addressed
| Risk | Status |
|---|---|
| Spam or abusive public reviews with no moderation | Partly mitigated: validation, rate limit and honeypot. **The biggest open risk.** Moderation (a report button, an approval queue) is the first follow-up. |
| A truncated or broken nightly export wipes the catalogue | Mitigated: never delete, 20% delisting guard, single transaction, audit table |
| Wrong status published because of conflicting PIM rows | Mitigated: the conflicting SKU is skipped and reported |
| Rate limit counters are per instance (in memory) | Accepted for one instance. Several instances need a shared store such as Redis. |
| Offset paging gets slow on deep pages at 50k | Accepted for v1. Keyset paging is the next step. |
| Row-by-row product updates during import | Fine for a nightly diff. A full rewrite of 50k rows would need a bulk `UPDATE … FROM` approach. |

## Deliberately left out
Authentication, review moderation, editing or deleting reviews, product images and safety data sheet downloads, i18n, an admin UI for import runs, and observability (metrics, structured logs, alerts).

## Next steps to production
1. Review moderation and reporting, then authentication for verified reviews.
2. Run the import as a scheduled job that alerts on `ABORTED` or `FAILED` runs and on row-level errors, and pull the export directly from the PIM.
3. Shared rate-limit store, keyset paging and a CI pipeline (lint, tests, image build).
4. Observability, security headers (CSP), a load test at 50k products.
5. Decide on the PrimeNG licence or an alternative so Angular can be upgraded.
6. i18n and SEO-friendly rendering if the catalogue goes public.

## Testing
- **Backend unit tests (75):** CSV parsing, every data problem in the import, duplicate handling, the import plan including the truncation guard, and search/filter query building.
- **API end-to-end tests (63), against a real PostgreSQL** in a separate test database: running the import twice gives identical counts, reviews survive re-imports, delisting and relisting, the truncation guard, the filter and region rules, sorting, review validation, `409` for discontinued products, and the rate limit.
- **Frontend tests (47):** converting the search state to and from the URL, the filter panel, the search and detail pages, review form validation, and sharing.
