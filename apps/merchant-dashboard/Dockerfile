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
COPY apps/merchant-dashboard/package.json apps/merchant-dashboard/
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
COPY apps/merchant-dashboard ./apps/merchant-dashboard
# Build shared packages first, then the Next.js app
RUN pnpm -r --filter=./packages/** build \
  && pnpm -C apps/merchant-dashboard install --silent \
  && pnpm -C apps/merchant-dashboard build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app/apps/merchant-dashboard

# Copy built app and dependencies
COPY --from=build /app/apps/merchant-dashboard ./
# Also copy root node_modules to satisfy pnpm symlinks
COPY --from=build /app/node_modules /app/node_modules

EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3001"]


