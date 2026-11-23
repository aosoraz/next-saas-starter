FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --config.node-linker=hoisted

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV POSTGRES_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV AUTH_SECRET=build-time-dummy-secret-at-least-32-chars
ENV STRIPE_SECRET_KEY=sk_test_dummy
ENV BASE_URL=http://localhost:3000
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder /app/boot.mjs ./boot.mjs

EXPOSE 3000
CMD ["node", "boot.mjs"]
