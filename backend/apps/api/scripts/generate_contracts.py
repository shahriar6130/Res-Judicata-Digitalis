import json
from pathlib import Path

from app.domain.evidence import EvidenceState
from app.main import app

REPOSITORY_ROOT = Path(__file__).parents[3]
CONTRACTS = REPOSITORY_ROOT / "packages" / "contracts"


def rendered_contracts() -> dict[Path, str]:
    return {
        CONTRACTS / "openapi.json": json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n",
        CONTRACTS / "evidence-states.json": json.dumps(
            [item.value for item in EvidenceState], indent=2
        )
        + "\n",
    }


def generate() -> None:
    CONTRACTS.mkdir(parents=True, exist_ok=True)
    for path, content in rendered_contracts().items():
        path.write_text(content)
        print(f"Wrote {path.relative_to(REPOSITORY_ROOT)}")


if __name__ == "__main__":
    generate()
