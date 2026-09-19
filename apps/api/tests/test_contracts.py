from app.domain.evidence import EvidenceState
from scripts.generate_contracts import CONTRACTS, rendered_contracts


def test_committed_contracts_match_the_fastapi_application_and_canonical_enum():
    for path, expected in rendered_contracts().items():
        assert path.read_text() == expected, (
            f"Run: uv run python -m scripts.generate_contracts ({path.name})"
        )


def test_evidence_state_contract_contains_every_backend_state_once():
    assert len(EvidenceState) == 8
    assert len({item.value for item in EvidenceState}) == 8
    assert (CONTRACTS / "evidence-states.json").exists()
