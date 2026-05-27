# Project 3：Multi-stage Build - 讓 image 不帶 build 工具

> 把 build 環境跟 runtime 環境分開，最終 image 只帶必要的東西。
> 用 Vite build 前端 + nginx 服務當案例。

## 為什麼需要 multi-stage

想像你要把一個前端網頁變成 Docker image：

**❌ 笨方法（單階段）**：

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm ci          # 裝 200MB 的 node_modules
RUN npm run build   # 產出 dist/
CMD ["npx", "serve", "dist"]
```

最終 image 包含什麼？
- Node.js runtime（用不到，最後是 serve 靜態檔案）
- npm（用不到）
- `node_modules/` 200MB（**用不到**，build 完就沒用）
- 原始 source code（**用不到**，已經被 build 成 dist/）
- 你的 `.env`、`.git`（如果沒寫 `.dockerignore`，敏感資料外洩）

最終 image：**~1.2 GB**，而你真正需要的東西不到 1 MB。

**✅ 聰明做法（multi-stage）**：

```
Stage 1: builder
  完整 Node 環境 → npm ci → npm run build → 產出 dist/
                                                  │
                                                  │ COPY --from=builder
                                                  ▼
Stage 2: runtime
  只有 nginx + dist/ 裡的靜態檔案
  沒有 Node.js、沒有 node_modules、沒有 source code
```

最終 image：**~55 MB**，**少 20 倍**。

## 這個專案在做什麼

一個極簡的 Vite 專案（其實就是一個 HTML + 一段 JS），用 multi-stage build 包成可以用 nginx 服務的 image。

## 目錄結構

```
project3/
├── README.md
├── Dockerfile           # 課堂上一起寫
├── .dockerignore
├── package.json
├── vite.config.js
└── src/
    ├── index.html
    └── main.js
```

## 跑起來

```bash
cd project3

# Build
docker build -t multistage-demo .

# 跑起來
docker run --rm -p 8080:80 multistage-demo

# 瀏覽器打 http://localhost:8080
```

然後看 image 大小：

```bash
docker images multistage-demo
# REPOSITORY        TAG       SIZE
# multistage-demo   latest    ~55MB
```

## 課堂對比實驗

**最有教學效果的 demo**：刻意做個「沒有 multi-stage」的版本對比。

把 Dockerfile 改成（先存個備份）：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

build 之後比較：

```bash
docker images
# multistage-demo (multi-stage)   ~55 MB
# multistage-demo (single)        ~400 MB
```

**差 7 倍**。學生會記住這個對比。

## 核心觀念（課堂要講）

### 1. `FROM ... AS <name>` 是 stage 的名字

```dockerfile
FROM node:20-alpine AS builder   # 這個 stage 叫 "builder"
# ...

FROM nginx:alpine                # 這個是最終 stage（runtime），沒名字也可以
COPY --from=builder /app/dist /usr/share/nginx/html
```

`AS builder` 給 stage 命名，方便後面 `COPY --from=builder` 引用。

### 2. `COPY --from=<stage>` 把上一個 stage 的檔案拿過來

```dockerfile
COPY --from=builder /app/dist /usr/share/nginx/html
#                   ^^^^^^^^^^ 從 builder stage 的這個路徑
#                              ^^^^^^^^^^^^^^^^^^^^^^^^^ 複製到 runtime stage 的這裡
```

**重點**：只有被 `COPY --from` 的東西會進到最終 image。沒被 copy 的（node_modules、source code、build 工具）**完全不會進到最終 image**。

### 3. 最終 image = 最後一個 stage

Dockerfile 裡有多少 `FROM` 就有多少 stage。**最後一個 stage 是最終 image**，前面的 stage 只是「臨時工作區」。

### 4. `COPY --from` 也可以指向 image，不只 stage

```dockerfile
# 直接從某個 image 拿檔案，連 build 都不用
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
```

這就是 Project 1 backend Dockerfile 用 uv 的招式。

## 容易踩的坑

### 1. `package*.json` 的位置決定 cache 效益

```dockerfile
# ❌ 改任何 source code 都會重 npm ci（慢）
COPY . .
RUN npm ci

# ✅ npm ci 只在 package.json / package-lock.json 變動時跑
COPY package*.json ./
RUN npm ci
COPY . .
```

差別：第一個版本你改一行 `main.js`，`npm ci` 整個重跑（一分鐘）。第二個版本只有改 `package.json` 才會重跑。

### 2. 別把 `node_modules` 一起 COPY 進去

如果你本機有 `node_modules`，`COPY . .` 會把它包進 builder stage。

- **慢**：上傳 200MB 給 Docker daemon
- **錯**：本機 OS 跟 container OS 可能不同（M1 Mac 的 node_modules 拿到 Linux container 會壞）

**用 `.dockerignore` 排除掉**（已經寫好了）。

### 3. 想 debug 中間 stage？用 `--target`

```bash
# 只 build 到 builder stage，方便進去看
docker build --target builder -t debug-build .
docker run --rm -it debug-build sh
```

進去之後可以看 `/app/dist` 有沒有產出來、`node_modules` 裝對沒。**這招超實用**。

### 4. Stage 之間是獨立的環境

第一個 stage 裝的東西（apt、npm 套件），第二個 stage **完全沒有**，不要以為「上面裝過了下面就能用」。要繼續用就要再裝一次（或者把那個 stage 當 base）。

## 進階變體（Python 版本）

同樣概念套到 Python（這也是 Project 1 backend 可以改的方向）：

```dockerfile
# Stage 1: 用 uv 裝依賴到 venv
FROM python:3.14-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Stage 2: runtime 只 copy venv 跟 source
FROM python:3.14-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .
ENV PATH="/app/.venv/bin:$PATH"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

Runtime stage 沒有 uv、沒有 build 工具，只有 Python interpreter + 你需要的套件。

## 什麼時候不需要 multi-stage

不是每個 Dockerfile 都需要 multi-stage。**單純的純語言 runtime**（不需要 build / compile）通常一階段就夠：

- 跑一個 shell script → 一階段
- 跑一個 Python 直譯腳本（沒 C extension）→ 一階段也行
- 簡單的 CLI 工具用 PHP / Ruby / Python 寫 → 看狀況

**需要 multi-stage 的時候**：
- 你的應用有 `build` / `compile` 階段
- 你裝了一堆 dev dependency 只是為了 build
- 你的 source code 跟最終 runtime 用的東西不一樣
- 最終 image 大到不合理

## 為什麼這節要學

Multi-stage 是 Docker 從 17.05（2017）就支援的功能，但仍然有**大量 production Dockerfile 沒用**——很多人不知道、不會用、或懶得改。

學會這個，你的 image 立刻小一個數量級。CI/CD pipeline 推 image 的時間也大幅縮短。
