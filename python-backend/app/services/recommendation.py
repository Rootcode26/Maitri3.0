from collections import defaultdict
from typing import Any

from app.rules.schemas import Rule


def build_recommendations(
    matched_rules: list[Rule],
) -> list[dict[str, Any]]:
    """
    Build approval recommendations from matched rules.

    Multiple rules recommending the same approval are combined into
    a single recommendation.
    """

    grouped: dict[str, list[Rule]] = defaultdict(list)

    for rule in matched_rules:
        grouped[rule.then.recommend].append(rule)

    recommendations: list[dict[str, Any]] = []

    for approval_code, rules in grouped.items():
        matched_rule_ids = [rule.id for rule in rules]

        explanations = [
            rule.explanation
            for rule in rules
            if rule.explanation
        ]

        required_documents: list[str] = []

        for rule in rules:
            for document in rule.requiredDocuments:
                if document not in required_documents:
                    required_documents.append(document)

        recommendations.append(
            {
                "approvalCode": approval_code,
                "matchedRuleIds": matched_rule_ids,
                "explanation": " ".join(explanations),
                "requiredDocuments": required_documents,
            }
        )

    return recommendations