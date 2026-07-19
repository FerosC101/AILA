# AILA backend — Express run via tsx. The seeded SQLite DB (data/aila.db) ships
# inside the image, so the corpus is present on every deploy (writes are ephemeral
# unless you mount a disk or switch to Turso — see instructions).
FROM node:20-bookworm-slim

# Playwright is optional (only used when USE_PLAYWRIGHT=1). Skip the browser
# download at install time to keep the image small; enable it later if you want
# JS-rendered scraping.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# Install dependencies first (better layer caching). We include devDependencies
# because the app is started with `tsx`, which lives in devDependencies.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# App source + the seeded data/ directory
COPY . .

ENV NODE_ENV=production
# Render/Railway/Fly inject PORT; the app reads process.env.PORT (default 8787).
EXPOSE 8787
CMD ["npm", "start"]
