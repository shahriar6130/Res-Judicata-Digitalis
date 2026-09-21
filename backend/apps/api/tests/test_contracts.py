"""Contract validation test ensuring OpenAPI and state schemas match canonical definitions."""
import json
from pathlib import Path


def test_contracts_exist_and_are_valid_json():
    contracts_dir = Path(__file__).parent.parent.parent.parent / "packages" / "contracts"
    openapi_file = contracts_dir / "openapi.json"
    evidence_states_file = contracts_dir / "evidence-states.json"

    assert openapi_file.exists(), f"Missing {openapi_file}"
    assert evidence_states_file.exists(), f"Missing {evidence_states_file}"

    with open(openapi_file, "r", encoding="utf-8") as f:
        openapi = json.load(f)
        assert "openapi" in openapi
        assert "/health" in openapi.get("paths", {})
        assert "/cases" in openapi.get("paths", {})

    with open(evidence_states_file, "r", encoding="utf-8") as f:
        states = json.load(f)
        assert "milestone_states" in states
        assert "REQUIRES_HUMAN_RESOLUTION" in states["milestone_states"]
