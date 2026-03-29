# Stage 1: Build the Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Caddy
FROM caddy:2-alpine AS runner

# Copy built assets into Caddy's default serve directory
COPY --from=builder /app/dist /srv

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

# Caddy needs write access to /data (cert cache) and /config (admin state).
# Grant ownership to UID 1000 (the built-in caddy user) so the container can
# run as non-root, satisfying OpenShift's restricted SCC without anyuid.
RUN chown -R 1000:1000 /data /config

USER 1000

EXPOSE 8080
