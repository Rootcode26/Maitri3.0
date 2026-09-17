from fastapi import FastAPI
from app.api.routes.validation import router as validation_router
from app.api.routes.evaluation import router as evaluation_router
from app.services.rule_provider import register_rules_evaluator
from app.services.rules_adapter import RulesAdapter

app = FastAPI(title="Maitri internal decision service", version="0.1.0")
app.include_router(validation_router)
app.include_router(evaluation_router)
register_rules_evaluator(app, RulesAdapter())


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
