FROM node:22-alpine
WORKDIR /app

# Install security updates and a tiny init system
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user for the service
RUN addgroup -g 1001 sapmid && adduser -u 1001 -G sapmid -s /bin/sh -D sapmid

# Copy package manifest and install production dependencies
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy application code and helper modules
COPY --chown=sapmid:sapmid server.js ./
COPY --chown=sapmid:sapmid json-repair.js ./
COPY --chown=sapmid:sapmid response-mapper.js ./
COPY --chown=sapmid:sapmid .env.example ./

USER sapmid

ENV NODE_ENV=production
EXPOSE 3005

# Liveness probe used by Docker and the app UI "Test middleware" button
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/__health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
