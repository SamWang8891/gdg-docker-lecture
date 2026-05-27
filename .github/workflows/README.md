# GitHub Actions：自動 Build & Push Image

> 把 `project1/` 的 backend / frontend 自動 build 成 Docker image，
> 同時推到 **GHCR**（GitHub Container Registry）跟 **Docker Hub** 兩個地方。

## 這個 workflow 在做什麼

每次 push 到 `main` 或打 `v*` tag，GitHub Actions 會幫你：

1. Checkout 程式碼
2. 設定 QEMU + Buildx（支援 multi-platform build）
3. 登入 GHCR（用 GitHub 內建的 token）
4. 登入 Docker Hub（用你自己設的 secret）
5. 自動算 tag（latest / semver / sha 都會幫你打好）
6. 同時 build `linux/amd64` + `linux/arm64`，push 到兩個 registry

完整流程在同一份 [`build.yaml`](./build.yaml) 裡，每一步都有註解。

## 觸發條件

| 事件 | 會做什麼 |
|---|---|
| `push` 到 `main` | Build 後推 `latest`、`main`、`sha-<7碼>` 三個 tag |
| `push` git tag `v1.2.3` | Build 後推 `1.2.3`、`1.2`、`1`、`latest` |
| 手動在 GitHub UI 按 Run workflow | 同 `main` push（debug 用） |

## 需要設定的 GitHub Repo Secrets

GHCR 用 GitHub **內建** `GITHUB_TOKEN`，**不用自己設**。
但 Docker Hub 必須自己設兩個 secret：

| Secret 名稱 | 內容 | 怎麼來 |
|---|---|---|
| `DOCKERHUB_USERNAME` | 你的 Docker Hub 帳號名稱 | 註冊 Docker Hub 時用的 username |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token（**不是密碼**） | 在 Docker Hub 申請（步驟見下） |

### Step 1：申請 Docker Hub Access Token

1. 登入 [Docker Hub](https://hub.docker.com/)
2. 右上角頭像 → **Account settings** → **Personal access tokens**
3. **Generate new token**
   - Description：隨便寫，例如 `gdg-docker-lecture-ci`
   - Access permissions：選 **Read & Write**（要 push 需要寫入權限）
4. 按 Generate，**馬上複製** token（離開頁面就看不到了）

### Step 2：把 secret 加到 GitHub repo

1. 進入 repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**，加兩個：

   ```
   Name: DOCKERHUB_USERNAME
   Secret: <你的 Docker Hub username>
   ```

   ```
   Name: DOCKERHUB_TOKEN
   Secret: <剛剛複製的 access token>
   ```

### Step 3：確認 GHCR 權限有開

預設 `GITHUB_TOKEN` 只有 `contents:read`，要推 GHCR 必須有 `packages:write`。
這個 workflow 已經在檔案開頭顯式宣告：

```yaml
permissions:
  contents: read
  packages: write
```

所以不用改設定也能跑。但如果你的 repo Settings 把 **Actions → General → Workflow permissions** 整個鎖成 read-only，這段 override 會被擋掉。確認那個選項是 **Read and write permissions** 或 **Read repository contents and packages permissions** 即可。

## 怎麼下載（pull）image

每次 push 完，可以從**兩邊任選一邊** pull，內容一模一樣。

### 從 GHCR pull

```bash
# backend
docker pull ghcr.io/<GITHUB_USERNAME>/gdg-docker-lecture-backend:latest

# frontend
docker pull ghcr.io/<GITHUB_USERNAME>/gdg-docker-lecture-frontend:latest
```

> 注意 owner 全部小寫。workflow 第 86 行那段 `${GITHUB_REPOSITORY_OWNER,,}`
> 就是在處理「GitHub username 可能有大寫但 GHCR 路徑必須小寫」這件事。

如果 package 是 private，pull 前要先登入（用 PAT，需要 `read:packages` scope）：

```bash
echo $GITHUB_PAT | docker login ghcr.io -u <你的 GitHub username> --password-stdin
```

### 從 Docker Hub pull

```bash
# 把 <DOCKERHUB_USERNAME> 換成你設在 secret 裡的那個值
docker pull <DOCKERHUB_USERNAME>/gdg-docker-backend:latest
docker pull <DOCKERHUB_USERNAME>/gdg-docker-frontend:latest
```

Docker Hub 預設 public，pull 不用登入。

## 可以用哪些 tag

依 workflow 的 `metadata-action` 規則：

```bash
# 抓最新（main 分支）
docker pull ghcr.io/samwang8891/gdg-docker-lecture-backend:latest

# 抓特定版本（前提是有打過 v1.0.0 tag）
docker pull ghcr.io/samwang8891/gdg-docker-lecture-backend:1.0.0
docker pull ghcr.io/samwang8891/gdg-docker-lecture-backend:1.0
docker pull ghcr.io/samwang8891/gdg-docker-lecture-backend:1

# 抓特定 commit（reproducible 用，正式環境推薦這個）
docker pull ghcr.io/samwang8891/gdg-docker-lecture-backend:sha-abc1234
```

想看自己這次 push 實際產生了哪些 tag，去 **GitHub Actions** 那次 run 的最後一步 **"Image digest"** log，會把所有 tag 印出來。

也可以直接看 packages 頁面：
- https://github.com/SamWang8891/gdg-docker-lecture/pkgs/container/gdg-docker-lecture-backend
- https://github.com/SamWang8891/gdg-docker-lecture/pkgs/container/gdg-docker-lecture-frontend

## 常見踩坑

### 1. `denied: permission_denied` 推 GHCR

通常是 `permissions:` 沒寫，或 repo Settings 把 workflow 設成 read-only。檢查：

- workflow 檔案有 `permissions: packages: write`
- repo Settings → Actions → General → Workflow permissions 要是 **Read and write**

### 2. `denied: requested access to the resource is denied` 推 Docker Hub

- 確認 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` 兩個 secret 都有設
- Access Token 權限要是 **Read & Write**，不能只給 Read
- Token 不要用過期的（Docker Hub 可以設過期時間）

### 3. Build 很慢

`linux/arm64` 是用 QEMU emulate，會比 native 慢 5–10 倍。Demo 想加速可以暫時改成：

```yaml
platforms: linux/amd64    # 只 build x86，會快很多
```

### 4. 同樣的程式碼 build 第二次還是很慢

確認 `cache-from` / `cache-to` 有寫對。這個 workflow 已經有：

```yaml
cache-from: type=gha,scope=${{ matrix.name }}
cache-to: type=gha,mode=max,scope=${{ matrix.name }}
```

`scope` 一定要分開（用 `matrix.name`），不然 backend / frontend 會互相蓋掉對方的 cache。