"""Export only Person 2's response sections, not the combined P1/P2 envelope."""
import json
from pathlib import Path

from app.domain.response_models import Person2AssessmentResponse


def main():
    repository = Path(__file__).resolve().parents[2]
    destination = repository / "packages/contracts/schemas/person2-assessment-response.v2.schema.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    schema = Person2AssessmentResponse.model_json_schema(by_alias=True)
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "urn:udyogsetu:person2-assessment-response:2.0"
    destination.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    main()
