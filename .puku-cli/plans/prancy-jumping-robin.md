# Dashboard → WordPress-style Sidebar-Driven Sections

## Context

The citizen dashboard currently has **two competing navigation systems**:

1. **Sidebar** (`sidebar.tsx`): 4 entries — *My case*, *Message*, *Profile*, *File a complaint*. Each is a hash link.
2. **Tab strip** (`role-dashboard.tsx` lines 88–91): **5** tabs — *My case*, *Message*, *Case details*, *Get help*, *Complaint*. The set doesn't match the sidebar (extra `help`, no sidebar entry for it; `profile` sidebar vs `case details` tab label mismatch).

Because both exist, the citizen ends up seeing the same content reachable through either, plus a phantom `help` tab that no sidebar link points to. The user wants a clean WordPress Admin model: **the sidebar is the only navigation**, and exactly **one section** is visible in the main panel at a time, with no tab strip, no stacked panels.

The three new sections:

1. **Lodge a Complaint** — clean complaint submission interface (oral or text input, name, contact, case/complaint details, consent). Reuses the existing `ComplaintModal` panel (which is already a self-contained in-page section).
2. **My Cases** — list/grid of cases; clicking a case opens its detail panel showing the literal heading "CASE". Detail view is a placeholder for now.
3. **UDC Office** — empty structural placeholder, ready for future functionality.

Decisions confirmed with the user:
- Existing 5-tab strip **removed**; old panels (Cases / Messages / Profile / Help) **deleted**.
- Oral input added as a `textarea` alongside the existing complaint form fields.
- "CASE" detail panel shows the case ID + title with a literal "CASE" heading.

## Files to Modify

| File | Change |
|---|---|
| `frontend/lib/i18n.tsx` | Add i18n keys: `navUdcOffice`, `navLodgeComplaint`, `myCasesHeading`, `myCasesEmpty`, `caseDetailHeading`, `udcOfficeHeading`, `udcOfficeBody`, `complaintOralLabel`, `complaintOralPlaceholder`. Keep `navFileComplaint` (already exists); add `navLodgeComplaint` only if we want a distinct sidebar label like "Lodge a Complaint" vs the existing "File a complaint" wording. |
| `frontend/components/sidebar.tsx` | Replace `citizen` NAV_ITEMS with exactly three entries: `#complaint`, `#cases`, `#udc`. Remove the `getNavItems` fallback for citizen (still needed for other roles). |
| `frontend/components/role-dashboard.tsx` | Rewrite `CitizenDashboard` so: (a) no tab strip; (b) one panel mounted based on a single `section` state driven by URL hash; (c) sections: `complaint` (renders `ComplaintModal` + the Oral input field could live inside `ComplaintModal` or in a sibling wrapper — see below); `cases` (list); `udc` (placeholder). Delete the existing `cases`, `messages`, `profile`, `help` panels. |
| `frontend/components/complaint-modal.tsx` | Update export to accept a `showOralInput?: boolean` prop (default true). Render an oral-input textarea inside the form (above the message textarea) when the prop is on. Keep all existing fields intact. |
| `frontend/components/complaint-modal.module.css` | No structural changes needed — `.textarea` and `.field` already cover the oral input. |
| `frontend/components/role-dashboard.module.css` | Remove the now-dead `.tabs`, `.tab`, `.tabActive` block (lines ~36–46). Keep `.complaintLink` (still used by sidebar-injected class names if any remain). |

## Design Decisions

### 1. Single source of truth: URL hash
The active section is `complaint | cases | udc`, derived from `window.location.hash`. The sidebar's `<Link>` elements update the hash; a `hashchange` listener in `CitizenDashboard` mirrors it into React state. This matches the existing pattern the codebase already uses (sidebar.tsx already has hash-aware active-state; only `CitizenDashboard`'s logic is changing).

### 2. Panels are top-level, not nested under tabs
Today's `CitizenDashboard` returns five sibling `<section role="tabpanel">` nodes with a `<nav role="tablist">` strip above. After the change, the structure becomes:

```tsx
<main>
  {section === "complaint" && <ComplaintSection />}  {/* wraps ComplaintModal */}
  {section === "cases" && <CasesList />}
  {casesDetailCaseId && <CaseDetail case={casesDetailCaseId} />}
  {section === "udc" && <UdcOffice />}
</main>
```

- **No tab strip, no `role="tablist"`.** The WordPress Admin model uses full-page navigation, not inline tabs. Accessibility-wise this is `role="region"` per page, `aria-labelledby` to the panel's heading.
- The case-detail sub-view ("CASE") is layered on top of *My Cases*: when a case is clicked, the cases list disappears and the detail panel mounts. Back button returns to the list. State: `casesDetailCaseId: string | null`.

### 3. Oral input as a sibling form field
Inside the existing `ComplaintModal` (which is already an in-page `<section>`, not a real modal), add an "Oral input (paste/type your statement here)" `textarea` *above* the existing message textarea. The new prop `showOralInput` (default `true`) keeps the component reusable later if needed. We use the existing `.textarea` style — no CSS work required.

### 4. My Cases data shape
Hard-code a tiny demo list (1–3 cases) matching the existing SHK-DEMO-007 line. Render as a list/table — reusing the existing `.hairlineList` style if appropriate. Each row is a button that sets `casesDetailCaseId`. Clicking anywhere outside the case detail (or pressing a "Back to my cases" link) clears it.

```
SHK-DEMO-007 · রহিমা বেগম বনাম মোহাম্মদ আলী
SHK-DEMO-011 · পারিবারিক আদালত মামলা
```

### 5. CASE detail placeholder
A panel showing:

```tsx
<section>
  <button onClick={() => setCasesDetailCaseId(null)}>← Back to my cases</button>
  <p className="eyebrow">{caseId}</p>
  <h1>CASE</h1>
  <h2>{caseTitleBn / caseTitleEn}</h2>
  <p className="deferred">Detailed case processing will be implemented in a later phase.</p>
</section>
```

Uses existing `.section`, `.sectionLabel`, `.eyebrow`, and `.deferred` styles.

### 6. UDC Office placeholder
Similar minimal structure:

```tsx
<section>
  <p className="eyebrow">UDC Office</p>
  <h1>{t("udcOfficeHeading")}</h1>
  <p>{t("udcOfficeBody")}</p>
</section>
```

### 7. Sidebar special-case for complaint
Drop the existing `complaintLink` red-dot styling from `sidebar.module.css` for the citizen role. Reason: with three flat sections, none of them is visually "out of band" — they're all peer navigation items. The `.listItemComplaint` + `.complaintLink` rules stay in the CSS module (they're scoped by class name and won't render with no element using them), but neither the citizen nor other roles use them. Removing them keeps the file clean.

Wait — re-reading the brief: *"Make the selected sidebar item visually obvious"* but no requirement for any special "complaint" treatment. So **remove** the red-dot styling from the sidebar for the citizen complaint link. Apply uniform link styling like the other two items.

### 8. Unchanged
- Top header (hamburger / language toggle) — kept as-is.
- Layout shell (`app/dashboard/layout.tsx`) — unchanged.
- All other roles' dashboards (Lawyer / DLO / Admin) — untouched.
- All i18n strings outside the new ones added for UDC / Cases / oral input.

## Verification

1. **Type-check:** `cd frontend && npx tsc --noEmit` — must show no errors (pre-existing `lib/portal-art.ts` errors remain).
2. **Lint:** `cd frontend && npm run lint` — must be clean.
3. **Dev server smoke test:**
   - `cd frontend && npm run dev &`
   - `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard/citizen` → `200`
   - `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/dashboard/citizen#udc"` → `200`
   - Same for `#cases`, `#complaint`, `#cases/SHK-DEMO-007` if we expose it.
4. **HTML inspection:** `curl -s http://localhost:3000/dashboard/citizen > /tmp/c.html`
   - `grep -oE 'role="tablist"' /tmp/c.html` → must be **0** (no tab strip).
   - `grep -c 'class.*citizen-section' /tmp/c.html` if we mark sections, otherwise just verify only one panel content is visible by counting the section headings.
   - `grep -c 'Lodge a Complaint\|File a complaint\|অভিযোগ' /tmp/c.html` → ≥ 1.
   - `grep -c 'UDC Office\|udc' /tmp/c.html` → ≥ 1.
5. **Manual (user-side, browser):**
   - Visit `/dashboard/citizen` → see *My Cases* list (default).
   - Click *Lodge a Complaint* in sidebar → only the complaint form appears, with an Oral input textarea visible near the top.
   - Click *UDC Office* in sidebar → only the UDC placeholder appears, the complaint form is gone.
   - Click a case row → only the case detail (with heading "CASE") appears, the list is gone.
   - Click "Back to my cases" → only the list reappears, no detail.
   - Refresh on `/dashboard/citizen#complaint` → lands on the complaint form, not the list.
6. **Repeated-click safety:** Clicking the active sidebar item must not break the view (URL hash unchanged → no `hashchange` fired → state stays valid).
