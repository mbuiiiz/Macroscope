"""
MacroScope — NewsAPI fetcher.
Fetches articles from NewsAPI for each configured query and deduplicates by URL.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

NEWSAPI_BASE = "https://newsapi.org/v2/everything"


async def fetch_articles() -> List[Dict[str, Any]]:
    """
    Run all configured queries against NewsAPI and return a deduplicated list
    of raw article dicts.
    """
    if not settings.NEWS_API_KEY:
        logger.warning("NEWS_API_KEY not set — skipping NewsAPI fetch.")
        return []

    seen_urls: set = set()
    all_articles: List[Dict[str, Any]] = []

    # NewsAPI free tier only accepts YYYY-MM-DD (date-only) for the `from` param.
    # Full ISO datetime with time is a paid-tier feature — using it on free
    # accounts returns 0 results silently. Use 7 days to guarantee coverage.
    from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=20) as client:
        for query in settings.NEWS_QUERIES:
            try:
                resp = await client.get(
                    NEWSAPI_BASE,
                    params={
                        "q": query,
                        "from": from_date,
                        "language": "en",
                        "sortBy": "publishedAt",
                        "pageSize": 20,
                        "apiKey": settings.NEWS_API_KEY,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

                articles = data.get("articles", [])
                for art in articles:
                    url = art.get("url", "")
                    if not url or url in seen_urls:
                        continue
                    # Skip removed articles
                    if art.get("title") in (None, "[Removed]"):
                        continue
                    seen_urls.add(url)
                    all_articles.append(art)

                logger.info(
                    "Query '%s': %d new articles (total so far: %d)",
                    query[:40],
                    len(articles),
                    len(all_articles),
                )

            except httpx.HTTPStatusError as exc:
                logger.error("NewsAPI HTTP error for query '%s': %s", query, exc)
            except Exception as exc:
                logger.exception("Unexpected error fetching query '%s': %s", query, exc)

    logger.info("Total raw articles fetched: %d", len(all_articles))
    return all_articles


def parse_article(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalise a raw NewsAPI article dict into a clean internal dict."""
    published_str = raw.get("publishedAt", "")
    try:
        published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
    except Exception:
        published_at = datetime.now(timezone.utc)

    return {
        "url": raw.get("url", ""),
        "source_name": (raw.get("source") or {}).get("name", ""),
        "raw_title": raw.get("title", "") or "",
        "raw_description": (raw.get("description") or raw.get("content") or "")[:2000],
        "published_at": published_at,
    }