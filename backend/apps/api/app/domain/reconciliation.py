"""Evidence reconciliation domain engine for Shakkho.

Preserves conflicting claims and derives explainable milestone states without
assuming the latest observation is true.
"""
from typing import List, Dict, Any, Tuple
from datetime import datetime


def reconcile_case_observations(
    existing_observations: List[Dict[str, Any]],
    new_observation: Dict[str, Any],
) -> Tuple[bool, List[str], Dict[str, Any]]:
    """Evaluate whether a new observation creates an evidentiary conflict.

    Returns:
        (has_conflict: bool, flags: List[str], derived_milestone_update: Dict[str, Any])
    """
    field_key = new_observation.get("field_key")
    new_value = str(new_observation.get("raw_value", "")).strip().lower()

    conflicting_sources = []
    has_conflict = False

    for obs in existing_observations:
        if obs.get("field_key") == field_key:
            prev_value = str(obs.get("raw_value", "")).strip().lower()
            if prev_value != new_value:
                has_conflict = True
                conflicting_sources.append(
                    f"{obs.get('source_role', 'UNKNOWN')} ({obs.get('raw_value')}) vs "
                    f"{new_observation.get('source_role', 'UNKNOWN')} ({new_observation.get('raw_value')})"
                )

    derived_update = {
        "status": "REQUIRES_HUMAN_RESOLUTION" if has_conflict else "ACCEPTED_PENDING_GATE",
        "timestamp": datetime.utcnow().isoformat(),
        "conflicts": conflicting_sources,
    }

    return has_conflict, conflicting_sources, derived_update
