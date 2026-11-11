#!/bin/sh
# One-shot job run by docker compose before the API starts.
# 1. Apply pending migrations (an empty database gets the full schema).
# 2. Import the PIM export. Exit code 2 means the safety guard aborted the
#    import: the database is unchanged and still valid, so startup continues.
# 3. Add the demo reviews, unless SEED_DEMO_REVIEWS=false.
set -u

npx prisma migrate deploy || exit 1

node dist/import/import.cli.js "${IMPORT_FILE:-/data/products.csv}"
code=$?
if [ "$code" -eq 2 ]; then
  echo "Import aborted by safety guard; keeping the existing catalogue."
elif [ "$code" -ne 0 ]; then
  exit "$code"
fi

if [ "${SEED_DEMO_REVIEWS:-true}" = "true" ]; then
  node dist/reviews/seed-demo-reviews.cli.js || exit 1
fi
