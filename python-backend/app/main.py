import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.api.routes.validation import router as validation_router
from app.api.routes.evaluation import router as evaluation_router
from app.services.document_reader import build_document_processor
from app.services.rule_provider import register_rules_evaluator
from app.services.rules_adapter import RulesAdapter, TrustedRulesContext


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("INTERNAL_API_TOKEN"):
        raise RuntimeError(
            "INTERNAL_API_TOKEN must be set before the internal decision service starts"
        )
    yield


app = FastAPI(title="Maitri internal decision service", version="0.1.0", lifespan=lifespan)
app.include_router(validation_router)
app.include_router(evaluation_router)
# This portal is Maharashtra-only; the jurisdiction is owner-set context, not
# inferred from applicant answers. It lets MH rules reach an applicable state so
# the engine can commit to the application checklist.
register_rules_evaluator(app, RulesAdapter(lambda project_id, rules_version: TrustedRulesContext(jurisdiction="MH")))

if os.environ.get("DOCUMENT_READER_ENABLED", "").lower() in {"1", "true", "yes"}:
    app.state.document_processor = build_document_processor()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
