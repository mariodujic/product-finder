# Product Finder

## Commands

```bash
docker compose up --build -d     # whole stack: http://localhost:4200, API docs at /api/docs
docker compose down              # stop (add -v to wipe the database)

cd backend  && npm test          # unit tests
cd backend  && npm run test:e2e  # API e2e tests; needs the db container (docker compose up -d --wait db)
cd frontend && npm test
```

Docker Desktop must be running first. On Windows it doesn't start by itself.

## Conventions

- **Dependencies:** pin exact versions (`npm install --save-exact`), and pick a release that's at least two weeks old.
- **Verifying changes:** check through the real Docker stack, including the nginx proxy on port 4200, not just the dev server. The Swagger asset bug only showed up there.
- **API docs:** Swagger decorators sit on the validation DTOs and response classes. When you add or change an endpoint, update its decorators and `backend/test/swagger.e2e-spec.ts`.
