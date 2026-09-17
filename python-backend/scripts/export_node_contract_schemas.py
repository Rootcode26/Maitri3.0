"""Generate Node-facing schemas. This does not register FastAPI endpoints."""
import json
from pathlib import Path
from app.domain.api_contract_models import EvaluateRequest, EvaluateResponse, ValidateRequest, ValidateResponse

def main():
    destination = Path(__file__).resolve().parents[2] / "packages/contracts/schemas/node"
    destination.mkdir(parents=True, exist_ok=True)
    for name, model in [
        ("evaluate.request", EvaluateRequest), ("evaluate.response", EvaluateResponse),
        ("validate.request", ValidateRequest), ("validate.response", ValidateResponse),
    ]:
        schema = model.model_json_schema(by_alias=True)
        schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
        schema["$id"] = "urn:maitri:node:" + name + ":1"
        (destination / (name + ".schema.json")).write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
        print(name)

if __name__ == "__main__":
    main()
