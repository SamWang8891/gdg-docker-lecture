# =====================================
# Stage 1: builder - 完整 Node 環境
# =====================================
FROM node:20-alpine AS builder

WORKDIR /app

# 先 copy package files，利用 layer cache
# 只要 package.json / package-lock.json 沒變，npm ci 就用 cache
COPY package*.json ./
RUN npm ci

# 再 copy 其他檔案
COPY . .

# Build！產出 dist/ 資料夾
RUN npm run build

# =====================================
# Stage 2: runtime - 只有 nginx + 靜態檔案
# =====================================
FROM nginx:alpine

# 只 copy build 完的產物，node_modules 跟 source 都不會進來
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
