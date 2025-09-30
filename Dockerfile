FROM node:20-alpine

# Install curl for healthcheck, Python 3 og pip
RUN apk add --no-cache curl python3 py3-pip

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy Python requirements og installer dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy source code
COPY . .

# Compile TypeScript to JavaScript
RUN npx tsc -p tsconfig.docker.json

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8080/api/round/state || exit 1

# Start game engine (compiled JavaScript)
CMD ["node", "dist/engine/server.js"]



