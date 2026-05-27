# GDGoC NTUST - Docker 實作課程

> 2 小時實作導向的 Docker 教學，從容器化一個前後端應用，到把 Image 自動推上 registry。

## 課程目標

學完之後，你會知道：

- 為什麼要把服務包成 Docker Image，而不是直接給原始碼
- Docker 網路有哪幾種，什麼時候用哪種
- 多個 container 怎麼互相通訊（提示：**不要用 `localhost`**）
- 如何寫自己的 `Dockerfile`,並用 `docker compose` 編排多個服務
- Debian (apt) 跟 Alpine (apk) 兩大套件管理系統的差異
- 怎麼用 multi-stage build 把 image 縮小一個數量級
- 怎麼用 GitHub Actions 自動 build & push 到 GHCR / Docker Hub

## 先備知識

請在來上課前確認：

- [ ] 電腦上已安裝 Docker（Docker Desktop 或 Docker Engine 皆可）
- [ ] 能在 terminal 跑 `docker version`、`docker compose version`
- [ ] 大致知道 Docker 跟 VM 的差別（不用很深，課程會帶到）
- [ ] **Windows 使用者**：建議先安裝 WSL2(推薦 Ubuntu) 並讓 Docker Desktop 使用 WSL2 backend
- [ ] 有 GitHub 帳號（最後一段會用到）

不要求：
- 不用很會 Python / JavaScript / PHP，範例都很短
- 不用會 nginx，會教基本設定

## 專案結構

```
gdg-docker-lecture/
├── project1/   # 前後端容器化 + Docker Network + Compose
├── project2/   # apt vs apk - Debian / Alpine 套件管理對照（PHP）
└── project3/   # Multi-stage build（Vite + nginx）
```

- **project1** 是課程主軸，從 0 把前後端容器化、用 compose 編排、設定網路讓兩個容器互通
- **project2** 對比 Debian (`apt`) 跟 Alpine (`apk`) 兩大套件管理，用 PHP 當案例
- **project3** 講 multi-stage build，最終 image 比單階段小一個數量級
- 最後一段是 CI/CD，把 image 自動推到 GHCR 跟 Docker Hub

每個子資料夾都有自己的 `README.md`，可以當講義也可以課後回顧。

## 課程大綱（2 小時）

| Block | 內容 | 時間 |
|---|---|---|
| 0 | 環境檢查 + 為什麼需要 Docker | 5 min |
| 1 | 用 Dockerfile 把 FastAPI 後端容器化（`project1/docker/backend`）| 25 min |
| 2-A | **Docker Network 完整解析**（6 種 driver、用途、決策）| 15 min |
| 2-B | 加入 nginx 前端 + 用 Compose 串起來（`project1/docker/frontend`）| 20 min |
| 3 | apt vs apk + PHP（`project2/`）| 15 min |
| 4 | Multi-stage build（`project3/`）| 10 min |
| 5 | GitHub Actions 自動推 image 到 GHCR / Docker Hub | 20 min |
| - | Q&A 緩衝 | 10 min |

### Block 2-A 細部內容（Docker Network）

這段刻意拉出來，因為**這是學生最常踩坑的地方**。會講：

- 為什麼容器內 `localhost` 不會通到其他容器
- 6 種 network driver：`bridge` / custom bridge / `host` / `none` / `overlay` / `macvlan`
- 預設 bridge vs 自建 bridge 的差別（DNS 解析）
- `host` network 在 Linux / Docker Desktop 上行為的差異
- `host.docker.internal` 是什麼，什麼時候才需要用
- 「container 之間互通」vs「container 連 host」vs「host 連 container」三種場景
- 決策樹：什麼情況該用哪種 network

詳細的 network 章節寫在 [`project1/README.md`](./project1/README.md)。

### Block 3 細部內容（apt vs apk）

- apt 跟 apk 的指令對照（update / install / clean / etc）
- 套件命名慣例不同（`php-cli` vs `php83-cli`）
- 容易踩的 4 個坑（cache 陷阱、`--no-cache`、`DEBIAN_FRONTEND`、musl vs glibc）
- 什麼時候選 Debian、什麼時候選 Alpine

詳細在 [`project2/README.md`](./project2/README.md)。

### Block 4 細部內容（Multi-stage）

- 為什麼需要 multi-stage（單階段 image 的問題）
- `FROM ... AS <name>` 跟 `COPY --from=<stage>` 怎麼運作
- 對比實驗：單階段 vs multi-stage 的 image 大小差距
- 進階：用 `--target` debug 中間 stage
- 什麼時候**不**需要 multi-stage

詳細在 [`project3/README.md`](./project3/README.md)。

## 課前準備（可選但推薦）

如果想跟上節奏，課前可以先：

1. 把這個 repo clone 下來
2. docker pull 下面這幾個 image（不 pull 也沒關係，課堂上會帶）：
   - `python:3.14-slim`
   - `node:20-alpine`
   - `nginx:alpine`
   - `alpine:3.20`
   - `debian:bookworm-slim`

如果不會 uv 也沒關係，課堂上會帶。

## 教學風格

這堂課**重實作、輕投影片**。我會故意讓某些東西壞掉（例如用 `localhost` 互 call 失敗），讓你親手 debug 一次，比直接告訴你結論記得久。

遇到問題請隨時打斷發問。
