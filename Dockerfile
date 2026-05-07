FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace manifests for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy all package.json files
COPY lib/db/package.json ./lib/db/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mekteb-arapsko-pismo/package.json ./artifacts/mekteb-arapsko-pismo/
COPY scripts/package.json ./scripts/

RUN pnpm install --frozen-lockfile

# Copy source
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

# Build API server and frontend
RUN pnpm --filter @workspace/api-server run build
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/mekteb-arapsko-pismo run build

# -------- Runtime image (smaller) --------
FROM node:24-bookworm-slim AS runner
RUN apt-get update \
 && apt-get install -y --no-install-recommends wget ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm
WORKDIR /app

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --prod --frozen-lockfile

# Copy built assets
COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/mekteb-arapsko-pismo/dist ./artifacts/mekteb-arapsko-pismo/dist
COPY --from=base /app/scripts/content-seed.json.gz ./scripts/content-seed.json.gz
# Drizzle migrations folder — REQUIRED by drizzle-migrate.ts at runtime startup.
# Without this, migrate() fails with "Can't find meta/_journal.json file" and
# new schema migrations never apply to production DB (causes 500 on endpoints
# that reference newly added columns).
COPY --from=base /app/lib/db/drizzle ./lib/db/drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
