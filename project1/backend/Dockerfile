# syntax=docker/dockerfile:1.7
FROM python:3.14-slim

# 從官方 uv image 直接 copy binary，不用 pip install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# uv 環境變數
#   UV_COMPILE_BYTECODE=1：build 時就把 .py 編成 .pyc，container 啟動更快
#   UV_LINK_MODE=copy：不用 hardlink（cache mount 跨 filesystem 會 warn）
#   UV_PYTHON_DOWNLOADS=never：不讓 uv 自己下載 Python（我們已經有 python base）
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# 先 copy lock 相關檔案，利用 layer cache
# 只要 pyproject.toml / uv.lock 沒變，這層就不會重跑
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# 再 copy 專案本體
COPY . .

# 安裝專案本身
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# 把 venv 的 bin 加進 PATH，可以直接呼叫 uvicorn
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# 注意：是 app:app 不是 main:app
#   第一個 app = 檔名 app.py
#   第二個 app = app.py 裡面的 FastAPI 物件
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
