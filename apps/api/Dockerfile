FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

WORKDIR /app

# --- Dependency layer -----------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# --- Build layer ----------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm turbo run build --filter=@aurahire/api

# --- Runtime layer --------------------------------------------
FROM base AS runner
ENV NODE_ENV=production

# LibreOffice + fonts for headless DOCX -> PDF conversion (DocxToPdfService).
# `libreoffice` (no -core split on Alpine) brings in writer; ttf-liberation
# replaces Debian's fonts-liberation. fontconfig ensures soffice can locate them.
RUN apk add --no-cache libreoffice ttf-liberation fontconfig

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/api
EXPOSE 3333
CMD ["node", "dist/main.js"]
