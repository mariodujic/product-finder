# Product Finder

Customers search, filter and review the specialty chemicals catalogue. The catalogue is loaded from the nightly PIM export (`data/products.csv`).

- Architecture and trade-offs: [DECISIONS.md](DECISIONS.md)
- How AI was used: [AI_USAGE.md](AI_USAGE.md)
- Original brief: [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md)

## Quick start (one command)

**Prerequisite:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with Compose v2).

```bash
docker compose up --build
```

Then open **http://localhost:4200**.

| Service | URL | What it is |
|---|---|---|
| web | http://localhost:4200 | Angular app (nginx, proxies `/api` to the API) |
| api | http://localhost:3000/api/health | NestJS API |
| db  | `localhost:5432` (user/password/db: `productfinder`) | PostgreSQL 18 |

To stop the stack, run `docker compose down`. To also wipe the database, run `docker compose down -v`.

On startup, a one-shot `migrate` container applies the database migrations, imports `data/products.csv` and adds a few sample reviews marked "(demo)". Starting the stack again is safe (see below). To start without the demo reviews, run `SEED_DEMO_REVIEWS=false docker compose up --build`.

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
