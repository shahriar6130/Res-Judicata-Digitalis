# Shakkho shared contracts

`openapi.json` is generated directly from the FastAPI application. `evidence-states.json` is
generated from the single backend `EvidenceState` enum. Do not edit either file manually.

From `apps/api`, regenerate and verify with:

```bash
uv run python -m scripts.generate_contracts
uv run pytest tests/test_contracts.py
```

Frontend work should consume `openapi.json`, use `evidence-states.json` for exhaustive state
handling, and use `examples/` as representative—not normative—payloads.
