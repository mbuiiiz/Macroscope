"""
MacroScope — Events API router.

Endpoints:
  GET /api/events          List events (filterable)
  GET /api/events/{id}     Single event detail
  POST /api/pipeline/run   Manually trigger the pipeline
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.storage import get_recent_events, get_event_by_id
from app.services.pipeline import run_news_pipeline

router = APIRouter()


@router.get("/events")
async def list_events(
    category: Optional[str] = Query(None, description="war|economy|politics"),
    region: Optional[str] = Query(None, description="Europe|Asia|Americas|Middle East|Africa|Global"),
    age_days: Optional[int] = Query(None, ge=1, le=3650, description="Filter events published within N days"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a list of enriched geopolitical events, formatted for the MacroScope frontend.

    Example: GET /api/events?category=war&region=Europe&age_days=7&limit=20
    """
    events = await get_recent_events(
        session=db,
        limit=limit,
        category=category,
        region=region,
        age_days=age_days,
    )
    return {
        "events": [e.to_dict() for e in events],
        "count": len(events),
    }


@router.get("/events/{event_id}")
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return a single event by ID (used for the detail page)."""
    event = await get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event.to_dict()


@router.post("/pipeline/run")
async def trigger_pipeline(background_tasks: BackgroundTasks):
    """
    Manually trigger the news pipeline (admin endpoint).
    Returns immediately; pipeline runs in background.
    """
    background_tasks.add_task(run_news_pipeline)
    return {"status": "pipeline started"}