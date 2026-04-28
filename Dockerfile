FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# 强制安装 Linux 平台绑定（Alpine/musl 可能不兼容，用 --force）
RUN npm ci && npm install @zvec/bindings-linux-x64@0.3.2 --force || true
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma（schema + migrations + client）
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 知识库和标签定义
COPY --from=builder /app/sysfiles ./sysfiles

# 数据目录
RUN mkdir -p data/zvec/sysknowledge_dim1536 data/zvec/sysknowledge_dim1024

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动前执行数据库迁移
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
