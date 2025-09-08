# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api-gateway/package.json apps/api-gateway/
RUN pnpm install --no-frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /pnpm/store /pnpm/store
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig*.json ./
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway
# Build shared packages used at runtime, then the app (clean to avoid stale dist)
RUN rm -rf apps/api-gateway/dist \
  && pnpm -r --filter=./packages/** build \
  # Ensure workspace deps are linked into app's node_modules
  && pnpm -C apps/api-gateway install --silent \
  && pnpm -C apps/api-gateway build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=build /app/apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY --from=build /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY --from=build /app/node_modules ./node_modules
# Include workspace packages (built dist) for PNPM symlinked deps
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["node", "apps/api-gateway/dist/main.js"]
