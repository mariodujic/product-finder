# Product Finder

Customers search, filter and review the specialty chemicals catalogue. The catalogue is loaded from the nightly PIM export (`data/products.csv`).

- Architecture and trade-offs: [DECISIONS.md](DECISIONS.md)

## Quick start

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose v2). Nothing else needs to be installed.

1. **Start Docker.** On Windows and macOS, open Docker Desktop and wait until it says the engine is running. If you skip this, the next step fails with `failed to connect to the docker API`.
2. **Start the app** from the repository root:

   ```bash
   docker compose up --build -d
   ```

   The first build takes a few minutes. The command returns when all containers are running. Leave out `-d` to keep the logs in your terminal (then press `Ctrl+C` to stop).
3. **Open http://localhost:4200** in your browser.
4. **Stop the app** when you're done:

   ```bash
   docker compose down        # stop; the database and reviews are kept
   docker compose down -v     # stop and wipe the database
   ```

| Service | URL | What it is |
|---|---|---|
| web | http://localhost:4200 | Angular app (nginx, proxies `/api` to the API) |
| api | http://localhost:3000/api/health | NestJS API, returns `{"status":"ok"}` when healthy |
| API docs | http://localhost:4200/api/docs | Interactive OpenAPI (Swagger) docs; raw spec at `/api/docs-json` |
| db  | `localhost:5432` (user/password/db: `productfinder`) | PostgreSQL 18 |

On startup, a one-shot `migrate` container applies the database migrations, imports `data/products.csv` and adds a few sample reviews marked "(demo)". Starting the stack again is safe (see below). To start without the demo reviews, run `SEED_DEMO_REVIEWS=false docker compose up --build -d`.

### Troubleshooting

- **Port already in use** (4200, 3000 or 5432): stop whatever is using it, for example a `npm run dev` session or another PostgreSQL.
- **Page loads but shows no products:** check the import with `docker compose logs migrate`. The last lines should report `Run #… SUCCEEDED`.
- **See what is running:** `docker compose ps`. **Follow the logs:** `docker compose logs -f api web`.

## Using the app

### Find products

The start page lists the whole active catalogue.

- **Search:** type in the search box to search by product name, chemical name or SKU (for example `polysorbate`, `emulsifier` or `P-10002`). Results update as you type.
- **Filter:** tick options under *Function*, *Application area*, *Region* and *Certifications*. The number next to each option shows how many products you'd get. Options that would give no results are greyed out. On a phone, open the filters with the **Filters** button.
- **Discontinued products** are hidden by default. Turn on *Include discontinued products* to see them.
- **Remove filters:** click a filter chip above the results to remove it, or **Clear all** to start over.
- **Sort:** use the drop-down to sort by name, launch year or best rating.
- **Page through results:** use the pager below the results to change the page or show 20, 50 or 100 per page.
- **Share a search:** the share button copies a link to the exact search, filters and sorting. On a phone it opens the share sheet. The address bar always holds the current search, so bookmarks and the browser's Back button work too.

### View a product

Click a product card to open its data sheet: SKU, chemical name, function, application area, region, launch year, certifications and description. Its status is shown at the top:

| Status | Meaning |
|---|---|
| Active | Available |
| Phase-out | Still available, but being replaced; consider a successor for new developments |
| Discontinued | No longer available |
| No longer offered | Removed from the latest PIM export; the page and its reviews stay reachable |

Use **Share** to copy a link to the product, and **Back to results** to return to your search.

### Read and write reviews

The product page shows the average rating and all reviews, newest first. To add one, fill in the *Share your experience* form:

- **Rating** (1–5 stars) — required
- **Your name or role** (2–80 characters) — required
- **Title** (up to 120 characters) — optional
- **Your review** (10–2000 characters) — required

Then click **Publish review**. It appears immediately. You can post up to 5 reviews per 10 minutes. Discontinued and no-longer-offered products don't accept new reviews.

## Loading the catalogue (PIM import)

The import is a CLI command that reads a PIM CSV export. Docker Compose runs it automatically on every `docker compose up`. To run it yourself:

```bash
cd backend
npm run db:migrate                          # apply migrations (empty database → schema)
npm run import -- ../data/products.csv      # import a PIM export
npm run import -- <file> --force            # bypass the mass-delisting safety guard
```

What the import guarantees:

- **Safe to re-run.** Products are matched by SKU. Unchanged products aren't written, and a second run reports `0 inserted, 198 unchanged`.
- **Reviews survive.** Products are never deleted. A SKU that disappears from the export is marked *not listed*: it's hidden from search, but its page and reviews stay reachable.
- **Dirty data is cleaned or reported, never guessed.** Status spellings are normalised and values trimmed. Rows that can't be shown correctly (no name, unknown status) are skipped. SKUs with *conflicting* duplicate rows are skipped, and their existing data is kept.
- **Truncated exports are rejected.** If an export would delist more than 20% of the catalogue, the import aborts with exit code 2 and changes nothing.
- Every run is recorded in the `import_runs` table, with counts and row-level warnings.

Demo reviews follow the same rules: `npm run seed:demo-reviews` adds only the missing ones and never touches real reviews.

## API

Full interactive documentation, with request and response schemas and a "Try it out" button, is at **http://localhost:4200/api/docs** while the app is running (the raw OpenAPI spec is at `/api/docs-json`). In short:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/products` | Search and filter: `q`, `function`, `applicationArea`, `region`, `certifications` (repeat a parameter for several values), `includeDiscontinued`, `sort` (`name`, `-name`, `launchYear`, `-launchYear`, `-rating`), `page`, `pageSize` (max 100). The response includes facet counts. |
| GET | `/api/products/:sku` | Product detail. Also serves discontinued and delisted products, so shared links keep working. |
| GET | `/api/products/:sku/reviews` | Reviews, newest first (`page`, `pageSize` max 50) |
| POST | `/api/products/:sku/reviews` | Write a review: `{ authorName, rating (1–5), title?, body }`. Rate-limited to 5 per 10 minutes per client IP. Returns 409 for products no longer sold. |
| GET | `/api/health` | Liveness check |

## Local development (live reload)

**Prerequisites:** Node.js 24+, npm 11+, Docker (for PostgreSQL only).

```bash
npm install      # once: installs root tooling, backend and frontend
npm run dev      # PostgreSQL in Docker, migrations + import, then API (:3000) + UI (:4200) with live reload
```

Open http://localhost:4200. The UI proxies `/api` to the API. Press `Ctrl+C` to stop the apps. `npm run db:stop` stops the database.

If the full Docker stack is running, stop it first with `docker compose stop api web`, because it uses the same ports.

## Tests

```bash
npm test                           # everything (from the repo root)

cd backend  && npm test            # backend unit tests
cd backend  && npm run test:e2e    # API end-to-end tests
cd frontend && npm test            # frontend component and service tests
```
