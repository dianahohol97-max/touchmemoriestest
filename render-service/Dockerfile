# Official Playwright image ships Chromium + all system libs it needs — this is
# the reliable way to run headless Chrome on Railway. The image tag MUST match
# the exact playwright version pinned in package.json (1.61.1), otherwise the
# bundled Chromium and the playwright client disagree and launch fails.
FROM mcr.microsoft.com/playwright:v1.61.1-jammy

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
