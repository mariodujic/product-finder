# Product Finder – Plan

## 1. What they're really testing

The feature list is small. The brief cares about **judgement**: what you notice that isn't written down, how you prioritise, and whether you can defend your choices. A few signals in the brief drive most of the design:

| Signal in the brief | What it means for the design |
|---|---|
| "unmodified example of an export" | The data is dirty on purpose, so the import step is a core part of the work. |
| 200 products now, about 50k later | Search, filtering, sorting and paging run on the server with database indexes. Nothing loads the whole catalogue into the browser. |
| Used on phones at trade fairs | The layout must be built for mobile first: filters in a slide-out drawer, cards instead of wide tables. |
| Customers ask about products we no longer sell | The `status` field matters to the business, and so does what happens when a product drops out of the export. |
| Send a colleague a link to exactly what I'm looking at | The whole search state lives in the URL, and every product has a stable address based on its SKU. |
| Reviews are public, with no login | This is the only write flow and the main abuse risk. It needs validation, rate limiting, length limits and safe output. |
| Import runs nightly, must be safe to re-run, reviews must survive | The import inserts new products and updates existing ones by SKU. It never hard-deletes a product. |

## 1a. Company context and design direction

**Company:** BASF (the contacts in the brief are @basf.com). The brief itself only says "a chemical company", and the product names in the CSV are fictional.

**Who uses it:** B2B technical buyers: formulators, R&D chemists and procurement in personal care, coatings, agriculture, food and similar industries. They know the terminology and want facts, not marketing, so the UI should feel like a precise technical catalogue, not a consumer shop.

**Design principles**
- **Industrial and trustworthy.** Calm, corporate, plenty of white space, no gimmicks. Inspired by BASF's corporate look: a dark blue primary, a lighter blue accent, neutral greys. We don't use the BASF logo or trademarks; the product is called "Product Finder" and the colours are design tokens that can be swapped for the official palette.
- **Data first, easy to scan.** Product cards lead with name and SKU, then chemical name, function, application area, region and certifications. The detail page reads like a short technical data sheet (a key/value spec table plus description).
- **Status is unmistakable.** Clear, colour-coded and labelled tags (Active / Phase-out / Discontinued), never colour alone. A Discontinued page shows a prominent banner. This addresses the "customers ask about products we no longer sell" problem.
- **Certifications as badges** (Vegan, Halal, Kosher, RSPO, REACH, EU Ecolabel, readily biodegradable). These are key buying criteria in these industries, so they're also filters.
- **Trade-fair mobile.** Mobile-first, large touch targets (≥44px), high contrast for bright halls, filters in a slide-out drawer, small bundle and fast first load on weak venue Wi-Fi, a native share button.
- **Accessible (WCAG 2.1 AA).** Contrast, keyboard navigation, labelled form controls, visible focus.
- **Reviews look like peer feedback.** A star rating plus a short text, with author name and date. No "verified" claims, since there's no auth.

**Tone:** factual and concise. English only for v1 (i18n is a "next step" for a global company).

## 2. Problems in the data

The file has 202 data rows and 200 unique SKUs.

| Issue | Rows | What I'd do |
|---|---|---|
| Exact duplicate SKU `P-10013` | rows 14 and 99 | Merge them and log a warning |
| Conflicting duplicate SKU `P-10151`: Active in one row, Discontinued in another | rows 153 and 203 | The last row in the file wins (assumption: a later row is a later edit). Log a warning. |
| Status in different spellings: `active`, `ACTIVE`, `Phase out` | P-10008, P-10024, P-10042 | Map them to a fixed set: `ACTIVE`, `PHASE_OUT`, `DISCONTINUED`. Skip any value that doesn't map. |
| Region with extra spaces: `" EMEA "` | P-10016 | Trim every field |
| Name with extra spaces | P-10059 | Trim |
| Empty name | P-10119 | Skip the row and report it. A product without a name can't be shown. |
| Launch year empty or `n/a` | P-10091, P-10105 | Store as empty (null). Don't drop the product over an optional field. |
| Quoted fields with commas and escaped `""` quotes | about 10 rows | Use a real CSV parser (`csv-parse`), never `split(',')` |
| Certifications are pipe-separated; 67 rows have none | – | Store as a list of strings with a search index |

The categories are clean otherwise: 8 functions, 9 application areas, 5 regions, 7 certifications.

## 3. Key decisions (recommended)

### Import pipeline (the most important part)
- The parse/normalise/validate step is pure functions with heavy unit tests. A separate step writes to the database.
- Products are matched by `sku`, which never changes. They get an internal ID, and reviews link to that ID.
- When a product is missing from a new export, it is **marked as not listed and never deleted**. Its reviews and shared links keep working. The database link from reviews to products blocks deletion, so a product with reviews can't be removed by accident.
- Safety guard: if the file would hide more than about 20% of the catalogue (for example a truncated export), stop and change nothing.
- Each import runs in one database transaction and writes in batches, so it scales to 50k rows.
- An `ImportRun` table records counts for each run: inserted, updated, unchanged, skipped and delisted, plus warnings.
- How it runs: a command-line script (`npm run import -- <file>`), Prisma's seed hook calls the same code, and a one-time Docker Compose service runs migrations and the import before the backend starts. In production it would be a nightly job.
- Demo reviews are optional and use fixed IDs, inserted only if missing, so re-running doesn't duplicate them.

### How status works for the business (an assumption, written down)
- Active products show normally.
- Phase-out products show with a warning badge.
- Discontinued and delisted products are hidden from search by default, with an "include discontinued" toggle. Their detail page still opens with a clear banner rather than a 404, because old shared links must keep working.
- Reviews on discontinued products can be read but not written.

### Search at 50k scale
- Use Postgres with the `pg_trgm` extension for partial matching on name, chemical name, SKU and description. Elasticsearch would be overkill and is a production "next step".
- Filters: several values within one category are combined with OR. Different categories are combined with AND. Certifications must all match (a product needs every selected certification).
- Assumption to note: filtering by EMEA also includes **Global** products.
- Filter counts (how many products match each option) come from the server.
- Sort by name, launch year or rating. The average rating and review count are stored on the product and updated in the same transaction as each new review, so sorting by rating stays fast.
- Paging uses offset/limit for now. Keyset paging would be the next step.

### Reviews
- Fields: author name, rating from 1 to 5 (also enforced in the database), optional title, body.
- Length limits, rate limiting with `@nestjs/throttler`, and a hidden honeypot field to catch spam bots.
- Angular escapes output by default, so no HTML is stored or rendered.
- Moderation is out of scope, but flagged as risk #1.

### Architecture
```
/backend   NestJS: PrismaModule, ProductsModule, ReviewsModule, ImportModule (CLI + service)
/frontend  Angular standalone components + signals, PrimeNG, SCSS
docker-compose.yml   db → migrate+seed (runs once) → api → web (nginx)
```

API:
- `GET /api/products` (search text, filters, sort, page, page size; returns items, total and filter counts)
- `GET /api/products/:sku`
- `GET /api/products/:sku/reviews`
- `POST /api/products/:sku/reviews`
- `GET /api/health`

Requests are validated with `class-validator`. The API is documented with Swagger.

### Frontend
- Two routes: `/products` and `/products/:sku`.
- One service keeps the search state in sync with the URL's query parameters. The search box waits briefly after typing before it searches.
- PrimeNG components: card list for results, multi-selects for filters, a drawer for filters on mobile, a paginator, the rating widget, and status tags.
- A share button uses the phone's share menu when available and otherwise copies the link.

## 4. Tests that give confidence where it matters
1. **Import unit tests:** one test per data problem in the table above.
2. **Import integration test against a real Postgres:** run the import twice and get identical counts; reviews survive; a product missing from the file gets delisted; the safety guard stops a bad import; duplicate SKUs are handled.
3. **API end-to-end tests:** filter and sort combinations, the Global region rule, review validation, and rejection of reviews on discontinued products.
4. **Frontend tests:** URL ↔ search state in both directions, review form validation, and the product list component.

## 5. Execution order (~8h)
| # | Step | Time |
|---|---|---|
| 0 | `git init`, set up the two projects, Docker Compose with Postgres, start the README | 1h |
| 1 | Prisma schema and migrations (including the `pg_trgm` indexes), parser and import with tests | 2h |
| 2 | Products API: search, filter counts, detail, plus end-to-end tests | 1.5h |
| 3 | Reviews API: validation, rating stats, rate limiting | 0.75h |
| 4 | Frontend: search page, detail page, review form, mobile layout | 2.5h |
| 5 | `DECISIONS.md`, `AI_USAGE.md`, final README, a clean run from an empty database | 0.75h |

**Running advice:** commit in small steps, since they'll look at the Git history. Keep a scratch log from the start of every time you reject or correct AI output. `AI_USAGE.md` needs at least two concrete examples, and they're hard to reconstruct afterwards.

## 6. Decisions (confirmed)
1. **Duplicate SKUs:** exact duplicates are merged with a warning. **Conflicting duplicates (e.g. `P-10151`) are not guessed:** the SKU is skipped for this run, the existing DB record (if any) stays untouched, and the conflict is reported in `ImportRun`. Rationale: "last row wins" would silently publish a possibly-wrong status (Active vs Discontinued) — exactly the business pain point; the PIM owner must fix the source. Supersedes the "last row wins" proposal in section 2.
2. **Discontinued products:** hidden from search by default with an "include discontinued" toggle; Phase-out shown with a warning badge; detail pages of discontinued/delisted products stay reachable with a banner (shared links never 404).
3. **Region:** filtering by a specific region also includes **Global** products.
4. **Docker:** the whole stack runs with one `docker compose up` (db → migrate+seed → api → web).

## 7. Evidence log (for DECISIONS.md)

**Search at 50k (2026-11-10).** 50,000 synthetic products in PostgreSQL 18, Docker on a laptop:

| Query | Time |
|---|---|
| Selective text search ("s-4999", 8 hits): BitmapOr over the 4 trigram GIN indexes | ~1 ms |
| Broad text search ("lauret", 5,713 hits = 11%): planner correctly picks a sequential scan | ~50 ms |
| First page, no filters, sorted by name | ~8 ms |
| Facet GROUP BY function | ~9 ms |
| Region + certification filter count (GIN on `certifications`) | ~5 ms |

A search request runs about 12 such queries in parallel (page, total, 3 grouped facets, about 7 certification counts). That's acceptable for v1. Next steps if needed: cache facet counts per query, or a single CTE query for all facets.

**Frontend version (decided 2026-11-11).** Angular **21** + PrimeNG **21.1.10** (MIT), not Angular 22. PrimeNG 22 (July 2026) moved to the commercial "PrimeUI License": free only for organisations under $1M revenue and 10 employees, needs a license key, and shows a watermark without one. It's also the only PrimeNG line that supports Angular 22. Angular 21 is in LTS until about May 2027. Upgrade path: buy PrimeNG licenses, then `ng update` to 22. Verified: no `@primeui/license-manager` in the dependency tree; primeng, primeicons and @primeuix/* are all MIT.
