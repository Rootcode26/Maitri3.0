"""Stage-specific dependencies. No universal statutory chain is assumed."""
from dataclasses import dataclass
from typing import Iterable
from app.rules.schemas import APPROVAL_CODES, DependencySpec

EXTERNAL_PREREQUISITES = frozenset({'consent-to-establish', 'fire-provisional-approval', 'boiler-inspection', 'boiler-hydraulic-test'})


@dataclass(frozen=True)
class DependencyEdge:
    target: str
    requirement: DependencySpec


def calculate_dependencies(approvals: Iterable[str], edges: Iterable[DependencyEdge] = (), *, stage: str = 'preparation', completed: Iterable[str] = (), parallel_groups: Iterable[Iterable[str]] = ()) -> dict:
    nodes = set(approvals)
    if nodes - APPROVAL_CODES:
        raise ValueError(f'Unknown approval codes: {sorted(nodes - APPROVAL_CODES)}')
    satisfied = set(completed)
    if satisfied - (APPROVAL_CODES | EXTERNAL_PREREQUISITES):
        raise ValueError('Unknown completed prerequisite')
    all_edges = list(edges)
    graph = {node: set() for node in nodes}
    for edge in all_edges:
        requirement = edge.requirement
        known = EXTERNAL_PREREQUISITES if requirement.external else APPROVAL_CODES
        if edge.target not in nodes or requirement.prerequisite not in known:
            raise ValueError('Unknown dependency target or prerequisite')
        if not requirement.external and requirement.prerequisite in nodes:
            graph[edge.target].add(requirement.prerequisite)
    # Detect cycles across the complete supplied graph, not just the current stage.
    pending = {node: set(parents) for node, parents in graph.items()}
    order: list[str] = []
    while pending:
        ready = sorted(node for node, parents in pending.items() if not parents)
        if not ready:
            raise ValueError('Dependency cycle detected')
        order.extend(ready)
        for node in ready:
            del pending[node]
        for parents in pending.values():
            parents.difference_update(ready)
    dependent, review, immediate = [], [], []
    for node in order:
        relevant = [edge.requirement for edge in all_edges if edge.target == node and edge.requirement.stage == stage]
        missing = [item for item in relevant if item.prerequisite not in satisfied]
        if any(item.verification == 'VERIFIED' for item in missing):
            dependent.append(node)
        elif missing:
            review.append(node)
        else:
            immediate.append(node)
    parallel = []
    for group in parallel_groups:
        group = sorted(set(group))
        if len(group) < 2 or set(group) - nodes:
            raise ValueError('Parallel group requires at least two known selected approvals')
        if stage != 'preparation':
            raise ValueError('Prototype concurrency only permits preparation, not legal processing')
        if not set(group) <= set(immediate):
            raise ValueError('Parallel group contains an unmet prerequisite')
        parallel.append({'approvals': group, 'stage': stage, 'verification': 'PROTOTYPE_ASSUMPTION', 'reason': 'Document preparation only; no concurrent statutory processing is asserted.'})
    return {'immediate': immediate, 'parallel': sorted(parallel, key=lambda item: item['approvals']), 'dependent': dependent, 'needsReview': review, 'order': order, 'missingPrerequisites': sorted({item.prerequisite for edge in all_edges for item in [edge.requirement] if item.stage == stage and item.prerequisite not in satisfied})}
