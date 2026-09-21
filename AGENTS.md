# AGENTS.md

## Working rules

- **Every requested product change must update the project documentation too.**
  When asked to change or add anything (auth, routing, UI, design, behaviour), the
  corresponding `.md` files under `docs/` and the relevant `README.md` files are updated
  in the same change, so later prompts can follow the documented path.
  Minimum touch points for a UI/product change: `docs/design/design.md`, and the
  specific area in `docs/spec/spec.md` or `docs/PRD/PRD.md`, plus the affected
  `README.md`.

- Frontend: all colours and fonts come from tokens, never hardcoded — see
  `frontend/app/tokens.css` and `frontend/app/layout.tsx`. Bangla (default) and English
  toggle covers the whole interface (see `frontend/lib/i18n.tsx`).

See `docs/` for canonical product, spec, architecture and design documents.