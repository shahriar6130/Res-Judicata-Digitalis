# DLAO-00 — Branch and architecture foundation

**Status:** Done  
**Branch:** `DLAO` (created from `main` at `eb756f8`)  
**Scope:** Repository audit, DLAO boundary, authorisation policy and documentation only.

| Evidence | Result |
|---|---|
| Branch | `DLAO` created and checked out; no merge performed |
| Existing architecture | FastAPI + Supabase/PostgreSQL + SQLAlchemy/Alembic backend; Next.js frontend; shared contracts |
| Authorisation foundation | Pure tenant/role/office/case policy plus focused allow/deny tests |
| Integrated | Not claimed—verified sessions and endpoint dependencies are future work |
| PDF completion | None claimed |
| Backend tests | `uv run pytest` — 9 passed |
| New-code lint | `uv run ruff check app/security app/modules/dlao tests/test_authorization.py` — passed |
| Backend smoke | `/`, `/health`, `/cases` — HTTP 200 through `TestClient` |
| Frontend verification | `npm run lint` and `npm run build` — passed; 35 static routes generated |

- **Human control:** decision actions are reserved for the authorised DLAO role in the foundation policy.
- **Known gap:** existing endpoints and initial RLS policies do not yet enforce user identity/scope.
- **Packaging repairs:** added the missing API-package README and explicit Hatch wheel package selection so `uv sync --extra dev` succeeds.
- **Existing repository debt:** repository-wide backend Ruff still reports 91 pre-existing findings outside this step; the new DLAO files are clean.
- **Remaining:** connect a verified server session and enforce the policy in tenant/office/case-filtered endpoints; tighten database RLS in the next authorised foundation slice.
- **Next:** stop before the next DLAO feature, as requested.
