"""
MacroScope — News pipeline orchestrator.

Flow:
  1. Fetch raw articles from NewsAPI
  2. Parse into internal dicts
  3. Filter by relevance keywords (cheap, local)
  4. Dedup against already-stored URLs
  5. Send to LLM for classification + market impact (expensive, batched)
  6. Store enriched events in DB

Concurrency: LLM calls are semaphore-limited to avoid rate-limiting.
"""
import asyncio
import logging
from typing import List, Dict, Any

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.event import Event
from app.services.news_fetcher import fetch_articles, parse_article
from app.services.relevance_filter import filter_articles
from app.services.llm_enricher import enrich_article
from app.services.storage import save_event

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)
# Max concurrent LLM calls (stay well within rate limits)
_LLM_SEMAPHORE = asyncio.Semaphore(3)


async def _enrich_with_limit(article: Dict[str, Any]) -> Dict[str, Any] | None:
    async with _LLM_SEMAPHORE:
        return await enrich_article(article)


async def _get_existing_urls() -> set:
    """Pull all stored source URLs to avoid re-processing."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Event.source_url))
        return {row[0] for row in result.all()}


async def run_news_pipeline() -> Dict[str, int]:
    """
    Run the full pipeline. Returns a summary dict with counts.
    """
    stats = {"fetched": 0, "relevant": 0, "new": 0, "enriched": 0, "saved": 0}

    # ── Step 1: Fetch ───────────────────────────────────────────────
    raw_articles = await fetch_articles()
    stats["fetched"] = len(raw_articles)
    if not raw_articles:
        logger.info("No articles fetched.")
        return stats

    # ── Step 2: Parse ───────────────────────────────────────────────
    parsed = [parse_article(a) for a in raw_articles]

    # ── Step 3: Keyword relevance filter ────────────────────────────
    relevant = filter_articles(parsed)
    stats["relevant"] = len(relevant)
    logger.info("%d / %d articles passed relevance filter", len(relevant), len(parsed))

    # ── Step 4: Dedup against DB ────────────────────────────────────
    existing_urls = await _get_existing_urls()
    new_articles = [a for a in relevant if a["url"] not in existing_urls]
    stats["new"] = len(new_articles)
    logger.info("%d articles are new (not yet in DB)", len(new_articles))

    if not new_articles:
        return stats

    # ── Step 5: LLM enrichment (concurrent, rate-limited) ──────────
    tasks = [_enrich_with_limit(art) for art in new_articles]
    results: List[Dict[str, Any] | None] = await asyncio.gather(*tasks, return_exceptions=False)

    enriched = [r for r in results if r is not None]
    stats["enriched"] = len(enriched)
    logger.info("%d / %d articles successfully enriched by LLM", len(enriched), len(new_articles))

    # ── Step 6: Store ───────────────────────────────────────────────
    for article in enriched:
        saved = await save_event(article)
        if saved:
            stats["saved"] += 1

    logger.info(
        "Pipeline complete — fetched:%d relevant:%d new:%d enriched:%d saved:%d",
        stats["fetched"], stats["relevant"], stats["new"], stats["enriched"], stats["saved"],
    )
    return stats