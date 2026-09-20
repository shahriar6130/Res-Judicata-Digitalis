from datetime import timedelta

from app.domain.reconciliation import FieldPolicy, ReconciliationPolicy

DEFAULT_POLICY = ReconciliationPolicy(
    fields={
        "hearing_date": FieldPolicy(
            field="hearing_date",
            authoritative_source_types=frozenset({"CAUSE_LIST", "COURT_ORDER"}),
        ),
        "hearing_outcome": FieldPolicy(
            field="hearing_outcome",
            authoritative_source_types=frozenset({"COURT_ORDER"}),
        ),
        "client_contact_status": FieldPolicy(
            field="client_contact_status",
            freshness_applies=True,
            freshness_window=timedelta(hours=72),
        ),
        "filing_status": FieldPolicy(
            field="filing_status",
            authoritative_source_types=frozenset({"COURT_RECEIPT"}),
        ),
    }
)
