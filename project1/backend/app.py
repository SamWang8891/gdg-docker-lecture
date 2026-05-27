from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Docker Class Demo API",
    version="0.1.0",
    description="NTUST GDGoC Docker 教學用 backend",
    root_path="/api",   # 告訴 FastAPI 它跑在 reverse proxy 的 /api 底下
)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- v1 router ----------
v1 = APIRouter(prefix="/v1", tags=["v1"])


@v1.get("/hello")
def hello_v1():
    return {"msg": "hello from v1", "version": "v1"}


@v1.get("/users/{user_id}")
def get_user(user_id: int):
    return {"user_id": user_id, "name": f"user-{user_id}"}


app.include_router(v1)


# ---------- 頂層 endpoint ----------
@app.get("/")
def root():
    return {"msg": "Docker class demo backend"}


# health check 注意：因為 root_path="/api"，這個其實會變成 /api/health
# 如果想要真正的頂層 /health，下面有說明
@app.get("/health")
def health():
    return {"status": "ok"}