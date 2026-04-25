"""
MacroScope — LLM enrichment service (Groq).

For each relevant article, calls the Groq API (OpenAI-compatible) to:
  1. Classify category (war | economy | politics)
  2. Identify country + region + coordinates
  3. Write a 2-sentence summary
  4. Generate asset predictions with direction / pct / reason
  5. Write a market impact summary
  6. Assign a risk level
  7. Suggest tags

Groq is used because it is fast (tokens/sec), cheap, and has a generous
free tier. It exposes an OpenAI-compatible REST API so we use httpx directly
(no extra SDK needed beyond what's already in requirements).
"""
import json
import logging
import re
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Country → approximate lat/lng centroid lookup
COUNTRY_COORDS: Dict[str, tuple] = {
    "Ukraine": (48.38, 31.17),
    "Russia": (61.52, 105.32),
    "United States": (37.09, -95.71),
    "China": (35.86, 104.20),
    "Germany": (51.17, 10.45),
    "France": (46.23, 2.21),
    "United Kingdom": (55.38, -3.44),
    "Japan": (36.20, 138.25),
    "South Korea": (35.91, 127.77),
    "Taiwan": (23.70, 120.96),
    "Israel": (31.05, 34.85),
    "Iran": (32.43, 53.69),
    "Saudi Arabia": (23.89, 45.08),
    "India": (20.59, 78.96),
    "Brazil": (-14.24, -51.93),
    "Turkey": (38.96, 35.24),
    "North Korea": (40.34, 127.51),
    "Pakistan": (30.38, 69.35),
    "Poland": (51.92, 19.15),
    "Italy": (41.87, 12.57),
    "Spain": (40.46, -3.75),
    "Canada": (56.13, -106.35),
    "Australia": (-25.27, 133.78),
    "Mexico": (23.63, -102.55),
    "Argentina": (-38.42, -63.62),
    "Egypt": (26.82, 30.80),
    "Nigeria": (9.08, 8.68),
    "South Africa": (-30.56, 22.94),
    "Indonesia": (-0.79, 113.92),
    "Philippines": (12.88, 121.77),
    "Vietnam": (14.06, 108.28),
    "Thailand": (15.87, 100.99),
    "Global": (20.0, 0.0),
    "EU": (50.85, 4.35),
    "NATO": (50.85, 4.35),
    "OPEC": (24.47, 54.37),
}

SYSTEM_PROMPT = """You are a geopolitical financial analyst AI.
Given a news article title and description, extract structured intelligence.
Respond ONLY with a valid JSON object — no markdown fences, no preamble, no explanation.

Required JSON schema:
{
  "title": "Clean, concise headline (max 80 chars)",
  "summary": "2-sentence plain-English summary of the event",
  "category": "war|economy|politics",
  "country": "Primary country/entity involved",
  "region": "Europe|Asia|Americas|Middle East|Africa|Global",
  "lat": <float centroid latitude>,
  "lng": <float centroid longitude>,
  "impact_summary": "2-sentence market impact explanation for traders",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "tags": ["tag1", "tag2", "tag3"],
  "assets": [
    {
      "symbol": "ASSET/TICKER (e.g. EUR/USD, BRENT, TSM, GOLD, QQQ)",
      "direction": "up|down|flat",
      "pct": "estimated % move as string e.g. '2.4'",
      "reason": "one-sentence rationale"
    }
  ],
  "ai_analysis": {
    "summary": "2-3 sentence deep event analysis",
    "market_impact": "2-3 sentence plain-English market impact for traders",
    "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "key_takeaway": "one sentence bottom line for traders",
    "asset_outlook": [
      {
        "symbol": "same symbols as assets above",
        "direction": "up|down|flat",
        "reason": "short reason",
        "confidence": "HIGH|MEDIUM|LOW"
      }
    ]
  }
}

Rules:
- assets: 2–5 items, relevant to this specific event
- direction: exactly "up", "down", or "flat"
- pct: positive number string, no % sign
- risk_level: reflects potential market disruption severity
- category "war" = armed conflict / military / terrorism
- category "economy" = monetary policy, trade, commodities, corporate
- category "politics" = sanctions, elections, diplomacy, legislation
- ai_analysis.asset_outlook must cover the same symbols as assets
- If country unknown, use "Global"
- Output ONLY the JSON object, nothing else"""


def _extract_json(text: str) -> Optional[dict]:
    """Extract a JSON object from the LLM response, stripping any fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


def _apply_coords(data: dict) -> dict:
    """Fill lat/lng from COUNTRY_COORDS if LLM didn't return valid floats."""
    country = data.get("country", "Global")
    lat = data.get("lat")
    lng = data.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        lat, lng = COUNTRY_COORDS.get(country, COUNTRY_COORDS["Global"])
        data["lat"] = lat
        data["lng"] = lng
    return data


def _sanitize_assets(assets: list) -> list:
    """Validate and normalise each asset entry."""
    clean = []
    for a in assets:
        if not isinstance(a, dict):
            continue
        symbol = str(a.get("symbol", "")).strip()
        direction = str(a.get("direction", "flat")).lower()
        if direction not in ("up", "down", "flat"):
            direction = "flat"
        pct = str(a.get("pct", "0")).replace("%", "").strip()
        reason = str(a.get("reason", ""))[:200]
        if symbol:
            clean.append({"symbol": symbol, "direction": direction, "pct": pct, "reason": reason})
    return clean[:5]


def _sanitize_ai_analysis(ai: Any) -> Optional[dict]:
    """Validate and normalise the ai_analysis nested object."""
    if not isinstance(ai, dict):
        return None
    outlook = []
    for item in ai.get("asset_outlook", []):
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol", "")).strip()
        direction = str(item.get("direction", "flat")).lower()
        if direction not in ("up", "down", "flat"):
            direction = "flat"
        confidence = str(item.get("confidence", "MEDIUM")).upper()
        if confidence not in ("HIGH", "MEDIUM", "LOW"):
            confidence = "MEDIUM"
        reason = str(item.get("reason", ""))[:200]
        if symbol:
            outlook.append({"symbol": symbol, "direction": direction,
                            "confidence": confidence, "reason": reason})
    risk = str(ai.get("risk_level", "MEDIUM")).upper()
    if risk not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        risk = "MEDIUM"
    return {
        "summary":       str(ai.get("summary", ""))[:600],
        "market_impact": str(ai.get("market_impact", ""))[:600],
        "risk_level":    risk,
        "key_takeaway":  str(ai.get("key_takeaway", ""))[:300],
        "asset_outlook": outlook[:5],
    }


async def enrich_article(article: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Send a single article to Groq for enrichment.
    Returns the article dict updated with LLM fields, or None on failure.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — skipping LLM enrichment.")
        return None

    user_content = (
        f"Title: {article.get('raw_title', '')}\n"
        f"Source: {article.get('source_name', '')}\n"
        f"Description: {article.get('raw_description', '')[:1200]}"
    )

    payload = {
        "model": settings.GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ],
        "max_tokens": 800,
        "temperature": 0.2,   # low temperature for consistent structured output
        "stream": False,
    }

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(GROQ_API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            body = resp.json()

        raw_text = body["choices"][0]["message"]["content"]
        data = _extract_json(raw_text)

        if not data:
            logger.warning(
                "Groq returned unparseable JSON for: %s",
                article.get("raw_title", "")[:60],
            )
            return None

        data = _apply_coords(data)
        data["assets"] = _sanitize_assets(data.get("assets", []))
        data["tags"] = [str(t).lower() for t in data.get("tags", [])][:8]
        data["ai_analysis"] = _sanitize_ai_analysis(data.get("ai_analysis"))

        article.update(data)
        return article

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Groq API HTTP error %s for article '%s': %s",
            exc.response.status_code,
            article.get("raw_title", "")[:60],
            exc.response.text[:300],
        )
        return None
    except httpx.TimeoutException:
        logger.error("Groq API timeout for article: %s", article.get("raw_title", "")[:60])
        return None
    except Exception as exc:
        logger.exception("Unexpected error during Groq enrichment: %s", exc)
        return None