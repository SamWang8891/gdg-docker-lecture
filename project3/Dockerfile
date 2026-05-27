# =====================================
# Stage 1: builder - 完整 Node 環境
# =====================================
# AS builder 給這個 stage 命名，下面 COPY --from=builder 才有得用
FROM node:20-alpine AS builder

WORKDIR /app

# 先 copy package*.json，利用 layer cache
# 只要 package.json / package-lock.json 沒變，npm ci 就用 cache
COPY package*.json ./
RUN npm ci

# 再 copy 其他檔案
COPY . .

# Build！產出 dist/ 資料夾
RUN npm run build


# =====================================
# Stage 2: runtime - 只有 nginx + 靜態檔
# =====================================
# 注意：這是「全新的 image」，前一個 stage 的東西完全沒繼承
# 只有 COPY --from=builder 拿過來的會進到這裡
FROM nginx:alpine

# 只 copy build 完的產物
# node_modules、source code、Node.js runtime 都不會進來
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine 預設 CMD 已經是 nginx -g 'daemon off;'，不用寫
