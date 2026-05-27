# =====================================
# Stage 1: builder - 完整 Node 環境
# =====================================
# 注意：用 node:20-slim（Debian slim 版）而不是 node:20（full Debian）
# 因為我們不需要完整 Debian 的所有工具
FROM node:20-slim AS builder

WORKDIR /app

# 先 copy package files，利用 layer cache
COPY package*.json ./
RUN npm ci

# 再 copy 其他檔案
COPY . .

# Build！產出 dist/ 資料夾
RUN npm run build

# =====================================
# Stage 2: runtime - 只有 nginx + 靜態檔案
# =====================================
# nginx:bookworm 是 Debian 12 base 的 nginx
FROM nginx:bookworm

# 只 copy build 完的產物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
