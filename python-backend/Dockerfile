# syntax=docker/dockerfile:1

# Maitri internal decision service (FastAPI). Stateless; reached only by the
# Node backend over the internal network, authenticated with X-Internal-Token.
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000
# INTERNAL_API_TOKEN must be provided at runtime or the app refuses to start.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
