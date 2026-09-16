from typing import Any, Literal

from pydantic import BaseModel, Field


class RuleCondition(BaseModel):
    field: str
    equals: Any | None = None
    greaterThan: Any | None = None
    in_: list[Any] | None = Field(default=None, alias="in")


class RuleConditions(BaseModel):
    all: list[RuleCondition] | None = None
    any: list[RuleCondition] | None = None


class RuleAction(BaseModel):
    recommend: str


class Rule(BaseModel):
    id: str
    version: int = Field(ge=1)

    when: RuleConditions

    then: RuleAction

    explanation: str

    requiredDocuments: list[str] = Field(default_factory=list)