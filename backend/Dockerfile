# MacroScope backend — production container image.
#
# Two-stage build:
#   1. builder: install Python deps into a virtualenv (cached layer)
#   2. runtime: copy only the venv + app code into a slim final image
#
# Why two stages:
#   - Final image is smaller (no pip cache, no build tools).
#   - Layer caching: requirements.txt rarely changes, so reinstalling
#     deps is skipped on most code-only rebuilds.
#
# Run locally:
#   docker build -t macroscope-backend .
#   docker run --rm -p 8000:8000 macroscope-backend
#   curl http://localhost:8000/health

# ─── Stage 1: builder ─────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Build deps for any wheels that need compilation (asyncpg sometimes does).
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a virtualenv and install requirements into it. Using a venv
# (rather than --user or system Python) makes the copy step in stage 2
# trivial: one directory, all the deps.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: runtime ─────────────────────────────────────────────────
FROM python:3.12-slim

# Run as a non-root user. ECS tasks shouldn't ever execute as root.
RUN groupadd --system app && useradd --system --gid app --home /app app

# Make /app writable by the app user before WORKDIR locks it in. The
# default DATABASE_URL is `sqlite+aiosqlite:///./macroscope.db`, which
# wants to create a file in the working directory — that fails on a
# root-owned WORKDIR even with non-root user. Once we move to RDS in
# Phase 3, this stops mattering, but keeping it is harmless.
RUN mkdir -p /app && chown app:app /app
WORKDIR /app

# Copy the venv from the builder stage. This is the only thing we keep
# from stage 1 — pip, build tools, and apt cache are all left behind.
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# App code goes last so source-only changes don't bust the deps cache.
COPY --chown=app:app app  ./app
COPY --chown=app:app tools ./tools

USER app

EXPOSE 8000

# Use uvicorn directly (not run.py with --reload) — reload is a dev-only
# feature and would slow startup + use more memory in production.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
