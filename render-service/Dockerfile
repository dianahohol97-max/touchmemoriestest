# Official Playwright image ships Chromium + all system libs it needs — this is
# the reliable way to run headless Chrome on Railway. Pin the version to match
# the playwright dependency in package.json.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install -D typescript @types/node @types/express @types/ws

# Build
COPY tsconfig.json ./
COPY server.ts ./
RUN npx tsc

# Chromium is already in the base image; tell Playwright to use it.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8080
CMD ["node", "dist/server.js"]
