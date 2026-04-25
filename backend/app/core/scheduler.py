"""
MacroScope — Background scheduler.
Runs the news-fetch → filter → LLM pipeline on a configurable interval.
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import init_db

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

_scheduler = AsyncIOScheduler()


async def _run_pipeline():
    """Import here to avoid circular imports at module load."""
    from app.services.pipeline import run_news_pipeline
    try:
        logger.info("⚡ Starting news pipeline run…")
        await run_news_pipeline()
        logger.info("✅ Pipeline run complete.")
    except Exception as exc:
        logger.exception("❌ Pipeline failed: %s", exc)


async def start_scheduler():
    await init_db()
    _scheduler.add_job(
        _run_pipeline,
        trigger=IntervalTrigger(minutes=settings.NEWS_FETCH_INTERVAL_MINUTES),
        id="news_pipeline",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — pipeline every %d minutes.",
        settings.NEWS_FETCH_INTERVAL_MINUTES,
    )
    # Run once immediately on startup
    await _run_pipeline()


async def stop_scheduler():
    _scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped.")