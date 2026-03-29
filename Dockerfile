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

# Make Caddy's runtime dirs writable by any group member (group 0) so the
# container runs under an arbitrary UID assigned by OpenShift's restricted SCC.
RUN mkdir -p /data /config \
    && chown -R root:0 /data /config \
    && chmod -R g=u /data /config

EXPOSE 8080
