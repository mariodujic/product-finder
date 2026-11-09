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

## Local development (without containerising the apps)

**Prerequisites:** Node.js 24+, npm 11+, Docker (for PostgreSQL only).

```bash
docker compose up -d db              # PostgreSQL only

cd backend && npm ci && npm run start:dev     # API on :3000
cd frontend && npm ci && npm start            # UI on :4200, proxies /api to :3000
```

## Tests

```bash
cd backend  && npm test            # unit tests
cd backend  && npm run test:e2e    # API end-to-end tests
cd frontend && npm test            # component and service tests
```
