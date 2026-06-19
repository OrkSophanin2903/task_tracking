# Multi-stage build for the Nuxt 3 SSR app (deployed via Coolify).
#
# In Coolify set the app's **Base Directory** to `frontend` so this Dockerfile
# and its build context are this folder. The Supabase URL/key are injected as
# runtime env vars by Coolify (NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY)
# — the build itself needs no secrets (runtimeConfig.public defaults to '').

# --- build stage: install all deps and compile .output ---------------------
FROM node:20-slim AS build
WORKDIR /app

# Install deps against the lockfile first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage: ship only the self-contained Nitro output --------------
# Nitro bundles its own dependencies into .output, so the runner needs no
# node_modules and no install step.
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Run as the image's non-root user.
COPY --from=build --chown=node:node /app/.output ./.output
USER node

EXPOSE 3000

# Lightweight health probe (Node 20 has global fetch; any <500 counts as up,
# so the /login redirect is treated as healthy).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
