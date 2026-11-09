# ---- build: full dependencies, generated Prisma client, compiled app ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# Scripts skipped here: postinstall (prisma generate) needs the schema, copied below.
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate && npm run build

# ---- migrate: one-shot job run by docker compose before the API starts ----
# Applies pending migrations, then imports the PIM export mounted at /data.
# Exit code 2 = import aborted by its safety guard: the database is unchanged and
# still valid, so the API may start. Any other failure stops the stack.
FROM build AS migrate
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/import/import.cli.js \"${IMPORT_FILE:-/data/products.csv}\"; code=$?; [ $code -eq 2 ] && exit 0 || exit $code"]

# ---- production dependencies only ----
FROM build AS prod-deps
RUN npm prune --omit=dev

# ---- runtime: the API ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main"]
