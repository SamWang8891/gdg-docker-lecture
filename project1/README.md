# Project 1：前後端容器化 + 互相通訊

> 課程主軸。從 0 把一個前後端應用容器化，並讓兩個容器透過 Docker 內部網路互通。

## 這個專案在做什麼

我們會做一個極簡的應用：

- **後端**：用 FastAPI 寫的 API server，有 `/api/v1/...` 的 endpoint
- **前端**：一個靜態 HTML 頁面，由 nginx 服務
- **nginx 同時當 reverse proxy**：把 `/api/*` 的請求轉發給後端

兩個服務各自跑在獨立的 container 裡，透過 Docker network 互相溝通。

## 架構

```
┌─────────────────────────────────────────┐
│  Host (你的電腦)                         │
│                                         │
│  localhost:8080                         │
│       │                                 │
│       ▼                                 │
│  ┌─────────────────────────────────┐    │
│  │  internal network (bridge)      │    │
│  │                                 │    │
│  │  ┌──────────┐    ┌──────────┐   │    │
│  │  │ frontend │───▶│ backend  │   │    │
│  │  │ (nginx)  │    │ (FastAPI)│   │    │
│  │  │  :80     │    │  :8000   │   │    │
│  │  └──────────┘    └──────────┘   │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘

- 瀏覽器只看得到 frontend (port 8080 對外)
- backend 完全藏在內部，沒有對 host 開 port
- frontend 用 service name "backend" 來 call 後端，不是 localhost
```

## 目錄結構

```
project1/
└── docker/
    ├── frontend/
    │   ├── index.html      # 簡單的網頁，會去 fetch /api/v1/hello
    │   ├── nginx.conf      # nginx 設定：靜態檔案 + reverse proxy
    │   └── Dockerfile      # 課堂上一起寫
    ├── backend/
    │   ├── main.py         # FastAPI app（課堂上會擴充）
    │   ├── pyproject.toml  # 用 uv 管依賴
    │   ├── .python-version
    │   ├── uv.lock
    │   └── Dockerfile      # 課堂上一起寫
    └── compose.yml         # 課堂上一起寫
```

---

# Docker Network 完整解析

> 這是整堂課**最容易踩坑**的章節，我們會花完整 15 分鐘把它講透。

## 為什麼要先理解 network

學 Docker 的人 9 成在「兩個 container 怎麼互通」這裡卡關。典型症狀：

- 在 container A 裡 `curl http://localhost:8000` → connection refused
- 把 host IP 寫死進 code → 換台電腦就壞
- Windows 用 Docker Desktop call backend 就是不通

這些都不是 bug，是**對 Docker network 的誤解**。把概念建立起來，這些問題會自動消失。

## 核心觀念：每個 container 有自己的 network namespace

```
┌────────────────────────────────────────────┐
│ Host                                       │
│                                            │
│   ┌──────────────┐    ┌──────────────┐     │
│   │ Container A  │    │ Container B  │     │
│   │              │    │              │     │
│   │ localhost    │    │ localhost    │     │
│   │   = 自己      │    │   = 自己     │     │
│   │              │    │              │     │
│   │ eth0: 172... │    │ eth0: 172... │     │
│   └──────┬───────┘    └──────┬───────┘     │
│          │                   │             │
│          └───── network ─────┘             │
│                                            │
└────────────────────────────────────────────┘
```

**Container 內的 `localhost` = container 自己**，不是 host，也不是其他 container。

要讓兩個 container 互通，必須：
1. 兩個 container 加入**同一個 network**
2. 用對方的 **container name / service name** 當 hostname（不是 `localhost`、不是 IP）

## Network Driver 全種類

Docker 內建 6 種 network driver，看看 `docker network ls` 預設就有 3 個：

```bash
$ docker network ls
NETWORK ID     NAME      DRIVER    SCOPE
abc123...      bridge    bridge    local
def456...      host      host      local
ghi789...      none      null      local
```

### 1. `bridge`（預設 bridge）⚠️ 通常不用它

- 所有沒指定 network 的 container 都會被丟進這個預設 bridge
- container 之間**可以用 IP 互通**，但**沒有 DNS 解析**（不能用名字互找）
- 透過 host 的 iptables NAT 連外網

**為什麼通常不用**：不能用名字互找，container IP 會變，沒辦法寫死。

### 2. Custom Bridge ✅ 99% 場景該用這個

- 你自己建的，或 docker compose 自動幫你建的
- **可以用 container name / service name 互找**（內建 DNS）
- 不同 custom bridge 之間預設**完全隔離**
- 安全、好用、可預期

```bash
# 手動建
docker network create my-net
docker run --network my-net --name backend ...
docker run --network my-net --name frontend ...
# frontend 內可以用 http://backend:8000 直接 call
```

Compose 預設行為：每個 compose project 會自動建一個 custom bridge，把所有 service 丟進去。**所以用 compose 就自動享有 service name 解析**，不用設定。

### 3. `host` ⚠️ 看似方便，問題很多

- container 跟 host 共用 network namespace
- container 內 listen `:80` = host `:80`（**完全沒有 port mapping 概念**）
- 效能最好（沒有 NAT 轉換）

**但是有幾個大坑**：

- 跟 host 上其他服務 port 會撞（你 host 的 nginx 已經佔 80 了？掰掰）
- 失去隔離，container 看得到 host 所有 network interface
- **Docker Desktop（Mac/Windows）上行為跟 Linux 不一樣**：因為 Docker 本身跑在 VM 裡，「host」是那台 VM，不是你的 Mac/Windows

什麼時候真的需要 `host`：
- 開發時要讓 container 看見 host 上隨機 port 的東西
- 極致效能（高頻交易、大流量 proxy）
- 需要用 host 的 raw socket / 特殊網路工具

**初學者建議**：不要碰 host，用 custom bridge + port mapping 就好。

### 4. `none`

- container 沒有任何網路（只有 loopback）
- 完全 air-gap

用途：純計算 job、安全 sandbox。日常開發很少用，但概念上要知道有。

### 5. `overlay`

- 跨**多台 Docker host** 的網路
- 用 VXLAN 在 host 之間建虛擬網路
- 給 Docker Swarm 用

單機 Docker 用不到。K8s 有自己的 CNI 不會用這個。**簡單知道有這玩意就好**。

### 6. `macvlan`

- 給 container 一個獨立 MAC，看起來像 LAN 上的實體機器
- 用途：legacy app 期待 L2 access、需要被 LAN 其他機器看到的服務（例如 DHCP server）

很冷門。**簡單知道有這玩意就好**。

## 一張表比較

| Driver | DNS 互找 | 對 host 開 port | 隔離性 | 典型用途 |
|---|---|---|---|---|
| `bridge`（預設） | ❌ | 需 `-p` 映射 | 中 | 幾乎不用 |
| **custom bridge** | ✅ | 需 `-p` 映射 | 高 | **預設選這個** |
| `host` | n/a | 直接共用 host | ❌ 無 | 極致效能 / debug |
| `none` | n/a | 完全沒有 | 最高 | 安全 sandbox |
| `overlay` | ✅ | 跨機 | 高 | Docker Swarm |
| `macvlan` | ❌ | 看起來是 LAN 機器 | 中 | Legacy app |

## 三種通訊場景

很多人混淆，分清楚就不會錯：

### 場景 A：container 之間互通

```
Container A  ───▶  Container B
```

**正確做法**：把 A 跟 B 放進同一個 custom bridge，用 service name。

```python
# 在 frontend container 內
requests.get("http://backend:8000/api/v1/hello")  # ✅
requests.get("http://localhost:8000/...")          # ❌ localhost = 自己
requests.get("http://172.18.0.3:8000/...")        # ❌ IP 會變
```

### 場景 B：host 連 container

```
你的瀏覽器  ───▶  Container
```

**正確做法**：用 `-p host_port:container_port` 把 port 暴露出來。

```bash
docker run -p 8080:80 nginx
# 瀏覽器打 http://localhost:8080
```

### 場景 C：container 連 host 上的服務

```
Container  ───▶  Host 機器上的 DB / 服務
```

**正確做法**（Docker Desktop）：`host.docker.internal`

```python
# 在 container 內，要連 host 機器上跑的 PostgreSQL
psycopg.connect("postgresql://host.docker.internal:5432/...")  # ✅
psycopg.connect("postgresql://localhost:5432/...")              # ❌
```

**Linux 原生 Docker**：預設沒這個 DNS，要加 `--add-host=host.docker.internal:host-gateway`。

## 決策樹

```
我想做什麼？
├─ 同 compose 的 container 互通
│   └─ 不用想，compose 自動建 custom bridge → 用 service name
│
├─ 兩個獨立 container 互通（不在同 compose）
│   └─ docker network create my-net
│       docker run --network my-net ...
│
├─ host 想連 container
│   └─ docker run -p 8080:80 ...
│
├─ container 想連 host 上的東西
│   ├─ Docker Desktop: 用 host.docker.internal
│   └─ Linux: --add-host=host.docker.internal:host-gateway
│
├─ 需要極致效能、沒有 isolation 需求
│   └─ --network host （注意：Docker Desktop 行為不同）
│
└─ 需要 container 在 LAN 上看起來像獨立機器
    └─ macvlan（罕見）
```

## Windows / Mac Docker Desktop 的特殊性

Docker Desktop 不是 native Docker，是 Docker 跑在 Linux VM 裡：

```
┌─────────────────────────────────┐
│ Windows / macOS                 │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Linux VM (HyperV/WSL2)  │   │
│   │                         │   │
│   │   Docker Engine         │   │
│   │   ├── Container A       │   │
│   │   └── Container B       │   │
│   │                         │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

這帶來幾個重點：

- `--network host` 的「host」是那個 Linux VM，不是你的 Windows/Mac
- `host.docker.internal` 會「穿透」VM 指向你的真實 host
- container 之間的通訊不受影響（service name 一樣工作）

之前教學遇到的 **「Windows 上 container 互 call 失敗」99% 都是用了 `localhost`**，不是 HyperV 的問題。

## 我們課程的選擇

對應到專案：

```yaml
# compose.yml 會這樣寫（精簡示意）
services:
  backend:
    # 沒有 ports → 不對 host 開
    networks: [internal]

  frontend:
    ports: ["8080:80"]   # 只有它對外
    networks: [internal]

networks:
  internal:   # custom bridge
    driver: bridge
```

- 兩個 service 在同一個 custom bridge
- frontend 在 nginx 設 `proxy_pass http://backend:8000`，**用 service name**
- backend 沒對 host 開 port，外面世界看不到它

---

## 其他學習重點

### nginx reverse proxy 的兩個經典坑

- `proxy_pass http://backend:8000;`（**結尾沒斜線**）→ 保留原始 path
- `proxy_pass http://backend:8000/;`（**結尾有斜線**）→ 砍掉 location 的 prefix

差一個字元行為完全不同。這是 nginx 最常見的 bug 來源。

### FastAPI 的 `root_path`

當 FastAPI 跑在 reverse proxy 後面（被掛在 `/api` 底下），需要設 `root_path="/api"`：

- Swagger UI (`/docs`) 裡的 "Try it out" 按鈕才會用對的 URL
- OpenAPI schema 才會生出正確的路徑
- 應用程式碼本身不用知道 `/api` 的存在

### 為什麼 `uvicorn` 要 `--host 0.0.0.0`

預設 `127.0.0.1` 只 listen container 內 loopback，**外面的世界（包括 host 的 port mapping）連不進來**。`0.0.0.0` = 接受所有來源。

## 跑起來

課堂上會帶大家從 0 寫起。最後完成版本：

```bash
cd project1/docker
docker compose up --build
```

然後打開：

- 前端：http://localhost:8080
- Swagger UI：http://localhost:8080/api/docs
- ReDoc：http://localhost:8080/api/redoc
- 直接打 API：http://localhost:8080/api/v1/hello

注意：**你不會直接打 backend 的 port**，因為它沒對外開。

## 故意製造的失敗（debug 練習）

課堂中會做這幾個對照實驗，幫助理解概念：

1. 把 `nginx.conf` 的 `proxy_pass http://backend:8000` 改成 `http://localhost:8000` → 壞掉。為什麼？
2. 把 `compose.yml` 的 `networks` 移除，讓兩個 container 各自獨立 → 壞掉。為什麼？
3. 故意把 `proxy_pass` 結尾的 `/` 加上 / 拿掉，看 path 怎麼變。
4. 進到 backend container 內，`curl http://localhost:8000/health` vs `curl http://backend:8000/health`，看差別。

## 技術棧

- **Python 3.14** + **FastAPI** + **uvicorn**
- **uv** - Python 套件管理（比 pip 快很多，類似 npm/cargo）
- **nginx:alpine** - 前端靜態檔案 + reverse proxy
- **python:3.14-slim** - 後端 base image
- **Docker Compose** - 多 container 編排

## 一些 debug 用的小工具

課堂上會 demo 這些指令：

```bash
# 看 network 有哪些
docker network ls

# 看某個 network 裡有誰
docker network inspect <network-name>

# 進到 container 裡看
docker compose exec backend sh
docker compose exec frontend sh

# 從 container 內測試另一個 container 通不通
docker compose exec frontend wget -O- http://backend:8000/health
```
