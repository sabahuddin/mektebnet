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

RUN pnpm install --frozen-lockfile

# Copy source
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/

# Build API server and frontend
RUN pnpm --filter @workspace/api-server run build
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/mekteb-arapsko-pismo run build

# -------- Runtime image (smaller) --------
FROM node:24-bookworm-slim AS runner
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --prod --frozen-lockfile

# Copy built assets
COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/mekteb-arapsko-pismo/dist ./artifacts/mekteb-arapsko-pismo/dist
COPY --from=base /app/lib/db/dist ./lib/db/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV SERVE_STATIC=true

EXPOSE 3000

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
