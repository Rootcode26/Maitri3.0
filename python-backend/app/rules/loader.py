"""Offline versioned YAML loading; JSON is a YAML 1.2 subset."""
import json
import re
from pathlib import Path
from typing import Any
from app.rules.schemas import APPROVAL_CODES, Rule


def _unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'Duplicate rule property: {key}')
        result[key] = value
    return result


def load_rule(path: str | Path) -> Rule:
    text = Path(path).read_text(encoding='utf-8')
    try:
        data = json.loads(text, object_pairs_hook=_unique)
    except json.JSONDecodeError:
        try:
            import yaml
        except ImportError as exc:
            raise RuntimeError('PyYAML is required for block-style YAML; bundled rules use JSON-compatible YAML.') from exc
        class UniqueLoader(yaml.SafeLoader):
            pass
        def mapping(loader: Any, node: Any) -> dict[str, Any]:
            return _unique([(loader.construct_object(key), loader.construct_object(value)) for key, value in node.value])
        UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
        data = yaml.load(text, Loader=UniqueLoader)
    if not isinstance(data, dict):
        raise ValueError(f'Rule must be a nonempty object: {path}')
    return Rule.model_validate(data)


def load_rules(directory: str | Path) -> list[Rule]:
    root = Path(directory)
    if not root.is_dir():
        raise ValueError(f'Rule directory does not exist: {root}')
    rules = [load_rule(path) for path in sorted(root.glob('*.yaml'))]
    seen: set[str] = set()
    for rule in rules:
        if rule.id in seen:
            raise ValueError(f'Duplicate rule ID/version selection: {rule.id}')
        seen.add(rule.id)
    return sorted(rules, key=lambda rule: (rule.id, rule.version))


def load_version(rules_version: str, *, root: Path | None = None) -> list[Rule]:
    if not re.fullmatch(r'[0-9]{4}\.[0-9]{2}', rules_version):
        raise ValueError('Unsupported rulesVersion')
    directory = (root or Path(__file__).parent / 'sets') / rules_version
    if not directory.is_dir():
        raise ValueError(f'Unsupported rulesVersion: {rules_version}')
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'), object_pairs_hook=_unique)
    if not isinstance(manifest, dict) or not isinstance(manifest.get('ruleIds'), list) or not isinstance(manifest.get('ruleVersions'), dict):
        raise ValueError('Manifest must declare ruleIds and pinned ruleVersions')
    if manifest['rulesVersion'] != rules_version:
        raise ValueError('Incompatible manifest rulesVersion')
    rules = load_rules(directory)
    if sorted(manifest['ruleIds']) != sorted(rule.id for rule in rules):
        raise ValueError('Manifest rule IDs do not match selected rules')
    versions = manifest['ruleVersions']
    if set(versions) != {rule.id for rule in rules} or any(type(versions.get(rule.id)) is not int or versions[rule.id] != rule.version for rule in rules):
        raise ValueError('Incompatible pinned rule versions')
    for rule in rules:
        if rule.then.scope == 'approval' and rule.then.recommend not in APPROVAL_CODES:
            raise ValueError(f'Unknown approval code: {rule.then.recommend}')
    return rules
