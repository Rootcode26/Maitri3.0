from pathlib import Path

import yaml

from app.rules.schemas import Rule


def load_rule(path: str | Path) -> Rule:
    """
    Load and validate a single YAML rule.

    Args:
        path: Path to the YAML rule file.

    Returns:
        A validated Rule object.

    Raises:
        ValueError: If the YAML file is empty or invalid.
    """
    rule_path = Path(path)

    with rule_path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)

    if data is None:
        raise ValueError(f"Rule file is empty: {rule_path}")

    return Rule.model_validate(data)


def load_rules(directory: str | Path) -> list[Rule]:
    """
    Load and validate all YAML rules from a directory.

    Args:
        directory: Directory containing YAML rule files.

    Returns:
        List of validated Rule objects sorted by filename.
    """
    rules_directory = Path(directory)

    if not rules_directory.is_dir():
        raise ValueError(f"Rule directory does not exist: {rules_directory}")

    rules: list[Rule] = []

    for path in sorted(rules_directory.glob("*.yaml")):
        rules.append(load_rule(path))

    return rules