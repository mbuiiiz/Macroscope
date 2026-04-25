"""
MacroScope — Configuration
All secrets come from environment variables / .env file.
"""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── News API ────────────────────────────────────────────────────
    NEWS_API_KEY: str = os.getenv("NEWS_API_KEY", "")  # https://newsapi.org/  (free tier: 100 req/day)
    NEWS_FETCH_INTERVAL_MINUTES: int = 60 # how often to poll

    # ── Groq ────────────────────────────────────────────────────────
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")  # https://groq.com/ (free tier: 100 req/month)
    # Fast, free-tier available models: llama-3.3-70b-versatile (best),
    # llama-3.1-8b-instant (faster/cheaper), mixtral-8x7b-32768
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Database ────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./macroscope.db"

    # ── CORS ────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "*"]

    # ── Geopolitical keywords for relevance filtering ───────────────
    # NewsAPI queries — keep short (1–3 words max). Long phrases return 0 results.
    NEWS_QUERIES: List[str] = [
        "war sanctions",
        "military conflict",
        "interest rates inflation",
        "central bank",
        "OPEC oil",
        "recession GDP",
        "geopolitical crisis",
        "trade tariffs",
        "currency forex",
        "semiconductor chips",
        "energy commodity",
        "nuclear threat",
        "stock market crash",
        "debt default",
        "drone strike",
    ]

    # Hard keyword filter — article must contain at least one of these
    RELEVANCE_KEYWORDS: List[str] = [
        "war", "conflict", "military", "sanctions", "missile",
        "inflation", "interest rate", "central bank", "fed", "ecb", "boj", "pboc",
        "opec", "oil", "crude", "gas", "energy",
        "recession", "gdp", "economic", "trade",
        "crisis", "geopolit", "tension", "coup", "protest",
        "tariff", "export", "import", "embargo",
        "currency", "devaluation", "forex",
        "semiconductor", "supply chain",
        "default", "debt", "sovereign",
        "nuclear", "drone", "airstrike",
        "commodity", "gold", "wheat", "copper",
    ]

    # Countries / regions we track
    TRACKED_COUNTRIES: List[str] = [
        "United States", "China", "Russia", "Ukraine", "Germany", "France",
        "United Kingdom", "Japan", "South Korea", "Taiwan", "Israel", "Iran",
        "Saudi Arabia", "India", "Brazil", "Turkey", "North Korea", "Pakistan",
        "EU", "NATO", "OPEC", "G7", "G20",
    ]

    # Maximum articles to process per fetch cycle (cost control)
    MAX_ARTICLES_PER_CYCLE: int = 30

    # Minimum relevance score (0–1) to keep an article
    MIN_RELEVANCE_SCORE: float = 0.15


settings = Settings()