# syntax=docker/dockerfile:1

# ===========================================================================
# LCWH production image. Multi-stage build → small Next.js standalone runtime.
# Used by Coolify (build from repo) and by local `docker compose` (app service).
# ===========================================================================

# ---- Base -----------------------------------------------------------------
FROM node:20-alpine AS base
# libc compat for Prisma engines on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder --------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client, then build (next.config sets output: "standalone").
RUN npx prisma generate
# DATABASE_URL is not needed to build; a dummy keeps env validation happy if
# any build-time code imports it. Real value is injected at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Standalone server + static assets.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma needs the schema + engine + CLI at runtime to run migrations.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Entrypoint runs `prisma migrate deploy` before starting the server.
COPY --chmod=0755 docker-entrypoint.sh ./docker-entrypoint.sh

# Uploads volume (local-disk StorageService). Coolify mounts a persistent
# volume here in production.
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORAGE_LOCAL_DIR=/data/uploads

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
