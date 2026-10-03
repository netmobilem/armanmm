# ---------- build stage ----------
# bookworm-slim (glibc) — better-sqlite3 has no musl/alpine prebuilds.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/vira.db
WORKDIR /app
RUN addgroup --system vira && adduser --system --ingroup vira vira && mkdir -p /app/data && chown -R vira:vira /app/data
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/node_modules ./node_modules
COPY scripts/migrate.mjs ./scripts/migrate.mjs
COPY scripts/bootstrap.mjs ./scripts/bootstrap.mjs
COPY packages/db/migrations ./packages/db/migrations
USER vira
VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||8080)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
