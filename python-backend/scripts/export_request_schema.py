"""Generate the checked-in request JSON Schema from Pydantic (not the response)."""
import json
from pathlib import Path

from app.domain.request_models import EvaluationRequest


def main():
    repository = Path(__file__).resolve().parents[2]
    destination = repository / "packages/contracts/schemas/evaluation-request.v2.schema.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    schema = EvaluationRequest.model_json_schema(by_alias=True)
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "urn:udyogsetu:evaluation-request:2.0"
    destination.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    main()
