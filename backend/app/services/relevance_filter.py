"""
MacroScope — Relevance filter.

Scores each article against geopolitical/financial keywords BEFORE sending
to the LLM (saves API cost by dropping clearly irrelevant articles early).

Score formula:
  - Each matched keyword contributes 1 point
  - Score is normalised to [0, 1] against a soft cap of 10 matches
  - Title matches are worth 2×
"""
import re
from typing import Dict, Any, List

from app.core.config import settings


def _text(article: Dict[str, Any]) -> str:
    return f"{article.get('raw_title', '')} {article.get('raw_description', '')}".lower()


def score_article(article: Dict[str, Any]) -> float:
    text = _text(article)
    title = article.get("raw_title", "").lower()

    hits = 0.0
    for kw in settings.RELEVANCE_KEYWORDS:
        kw_lower = kw.lower()
        body_count = len(re.findall(r"\b" + re.escape(kw_lower) + r"\b", text))
        title_count = len(re.findall(r"\b" + re.escape(kw_lower) + r"\b", title))
        hits += body_count + title_count * 2  # title bonus

    # Soft-cap normalisation: 10 hits → 1.0
    score = min(1.0, hits / 10.0)
    return round(score, 4)


def filter_articles(
    articles: List[Dict[str, Any]],
    min_score: float | None = None,
) -> List[Dict[str, Any]]:
    """
    Score all articles, attach the score, and return those above threshold
    sorted by score descending.  Caps at MAX_ARTICLES_PER_CYCLE.
    """
    threshold = min_score if min_score is not None else settings.MIN_RELEVANCE_SCORE
    scored = []
    for art in articles:
        s = score_article(art)
        if s >= threshold:
            art["relevance_score"] = s
            scored.append(art)

    scored.sort(key=lambda a: a["relevance_score"], reverse=True)
    return scored[: settings.MAX_ARTICLES_PER_CYCLE]