import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Search for .env in current working dir, project root, and backend dir
root_dir = Path(__file__).resolve().parent.parent.parent
env_paths = [
    root_dir / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env"
]
for p in env_paths:
    if p.exists():
        load_dotenv(p)
        break

class Settings(BaseModel):
    falkordb_host: str = os.getenv("FALKORDB_HOST", "")
    falkordb_port: int = int(os.getenv("FALKORDB_PORT", "6379"))
    falkordb_username: str = os.getenv("FALKORDB_USERNAME", "default")
    falkordb_password: str = os.getenv("FALKORDB_PASSWORD", "")
    falkordb_graph: str = os.getenv("FALKORDB_GRAPH", "orgmind_demo")
    falkordb_ssl: bool = os.getenv("FALKORDB_SSL", "false").lower() in ("true", "1", "yes")
    demo_mode: bool = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    orgmind_allow_live_writes: bool = os.getenv("ORGMIND_ALLOW_LIVE_WRITES", "false").lower() in ("true", "1", "yes")
    backend_port: int = int(os.getenv("BACKEND_PORT", "8000"))
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000").split(",")
        if origin.strip()
    ]
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    sqlite_db_path: str = os.getenv(
        "SQLITE_DB_PATH",
        str(root_dir / "backend" / "data" / "orgmind_memory.db")
    )

_settings = Settings()
if not _settings.groq_api_key:
    _groq_path = Path("/home/manav/Downloads/groqapi.txt")
    if _groq_path.exists():
        try:
            _val = _groq_path.read_text().strip()
            if _val:
                _settings.groq_api_key = _val
        except Exception:
            pass

def get_settings() -> Settings:
    return _settings

def update_settings(**kwargs) -> Settings:
    global _settings
    current_dict = _settings.model_dump()
    for k, v in kwargs.items():
        if k in current_dict and v is not None:
            current_dict[k] = v
    _settings = Settings(**current_dict)
    return _settings
