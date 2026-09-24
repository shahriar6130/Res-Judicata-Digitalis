/* ------------------------------------------------------------------ *
 *  Assisted-intake offline-first draft store.
 *
 *  PURPOSE
 *  ───────
 *  The Assisted Intake wizard (see `components/assisted-intake.tsx`)
 *  lets citizens start a new case on their phone. The most common
 *  failure mode in rural Bangladesh is intermittent connectivity:
 *  the citizen starts filling the form, the network drops, and what
 *  they typed is lost.
 *
 *  To survive this, every state change is mirrored into `localStorage`
 *  under two keys:
 *
 *    rjd.intake.drafts    → the in-progress form the user is editing
 *    rjd.intake.pending   → finished submissions waiting to be pushed
 *                           to the authoritative case system
 *
 *  When the device is online again, `syncPending()` will flush the
 *  queue to the backend. In this prototype the network call is a
 *  STUB — see `pushIntakeToBackend` below. Replace it with a real
 *  `POST /cases` request once the backend exposes the endpoint and
 *  remove the local-only success path.
 *
 *  SCHEMA NOTES FOR THE BACKEND IMPLEMENTER
 *  ─────────────────────────────────────────
 *  Each `IntakeSubmission` is the exact payload the future API should
 *  accept on `POST /api/v1/cases`. The field names and types here
 *  intentionally mirror what the FastAPI Pydantic model should look
 *  like, so swapping the stub for a real fetch is a one-line change:
 *
 *    POST /api/v1/cases
 *    {
 *      "applicant": { "name": "...", "phone": "...", "actingFor": "self"|"family"|"neighbor"|"alleged", ... },
 *      "matter":    { "category": "family"|"land"|"civil"|"criminal"|"labour"|"other" },
 *      "respondent":{ "name": "...", "address": "..." },
 *      "narrative": "...",
 *      "contact":   { "slot": "friday_morning"|"while_at_work"|"evening"|"anytime", "notes": "..." },
 *      "documents": [{ "name": "...", "mimeType": "...", "size": 12345, "dataUrl": "data:..." }],
 *      "consent":   { "confirmed": true, "phrase": "..." },
 *      "clientMeta":{ "createdAtIso": "...", "device": "web-pwa", "lang": "bn"|"en" }
 *    }
 *
 *  The backend will:
 *    1. Persist the case record + vault payload (NID image bytes etc.).
 *    2. Mint a canonical case id (e.g. SHK-2026-XXXX).
 *    3. Return that id to the client so the temporary receipt can be
 *       replaced with the real number in the success view.
 *    4. Hand the case to the DLAO queue per the Promise Engine rules
 *       (see PRD §5).
 *
 *  Data URLs in `documents[].dataUrl` are a prototype convenience so
 *  the wizard works without a storage bucket. In production, either:
 *    - upload each file to object storage first and send the URL, or
 *    - send multipart/form-data from the wizard and let the API store it.
 *
 *  CONFLICT HANDLING
 *  ─────────────────
 *  When the device comes back online with multiple pending drafts
 *  that were created against the same identity, the server should
 *  run the T4 duplicate-detection rules and respond with the canonical
 *  case id (which may equal an existing one or be freshly minted).
 *  Local code does NOT try to guess — it forwards everything and lets
 *  the server decide.
 *
 *  Once a pending entry has been pushed successfully it is removed
 *  from `rjd.intake.pending` and the temporary receipt is upgraded.
 *  If the push fails (network blip mid-flush) the entry stays in
 *  the queue and the next online tick retries it. This is the same
 *  retry-with-backoff loop the helpline and case-support apps use.
 * ------------------------------------------------------------------ */

export type ActingFor = "self" | "family" | "neighbor" | "alleged";

export type MatterCategory =
  | "family"
  | "land"
  | "civil"
  | "criminal"
  | "sexual_harassment"
  | "security"
  | "labour"
  | "other";

/** "anytime", or "custom" = a specific day + time the citizen enters. */
export type ContactSlot = "anytime" | "custom";

export type ContactDay = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

/**
 * One document the citizen attached. In the prototype we keep the
 * bytes inline as a `data:` URL so the file survives a refresh and
 * can be re-pushed. Production should swap this for an object-store
 * reference (see module header).
 */
export type IntakeDocument = {
  /** Stable client-side id so React lists don't re-render on every save. */
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** data: URL with the raw bytes — prototype only. */
  dataUrl: string;
};

export type IntakeDraft = {
  /** Citizen account that owns this draft (lib/dlas/citizen-auth). A draft
   *  never carries over to a different logged-in account. */
  ownerId?: string;

  /* --- Step 1: Identity --- */
  name: string;
  phone: string;
  actingFor: ActingFor | null;
  proxyRel: string;
  proxyName: string;
  proxyPhone: string;
  /** District code (lib/dlas DISTRICTS) — needed for routing in the shared record. */
  district: string;
  /** Applicant's NID number (optional; verified by the DLAO). */
  nidNumber: string;

  /* --- Step 2: Matter --- */
  matter: MatterCategory | null;

  /* --- Step 3: Parties + narrative --- */
  partyName: string;
  partyAddress: string;
  description: string;
  /** The citizen says it is urgent (and why) — shown to the DLAO in the "Urgent cases" tab; priority stays the officer's decision. */
  urgent?: boolean;
  urgencyFlags?: string[];

  /* --- Step 4: Documents --- */
  documents: IntakeDocument[];

  /* --- Step 5: Contact + consent --- */
  contactSlot: ContactSlot | null;
  /** Only when contactSlot === "custom". */
  contactDay: ContactDay | "";
  /** "HH:MM" (24h), only when contactSlot === "custom". */
  contactTime: string;
  specialInstructions: string;
  consentOk: boolean;
};

/**
 * A finished submission waiting for the network. The backend will mint
 * the real case id; `tempReceipt` is what the citizen sees meanwhile.
 */
export type IntakeSubmission = {
  tempReceipt: string;
  draft: IntakeDraft;
  createdAtIso: string;
  lang: "bn" | "en";
};

const DRAFTS_KEY = "rjd.intake.drafts";
const PENDING_KEY = "rjd.intake.pending";

/** Keep assisted UDC drafts separate from a citizen draft on the same device. */
function scopedKey(base: string, scope?: string): string {
  return scope ? `${base}.${scope.replace(/[^a-zA-Z0-9_-]/g, "_")}` : base;
}

/* ------------------------------------------------------------------ *
 *  Browser-safe accessors. All reads/writes are wrapped so SSR
 *  (Next.js static rendering) and storage-disabled browsers don't
 *  crash. Every public function returns `null` / `[]` on failure
 *  so the wizard can keep rendering.
 * ------------------------------------------------------------------ */

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function emptyDraft(): IntakeDraft {
  return {
    name: "",
    phone: "",
    actingFor: null,
    proxyRel: "",
    proxyName: "",
    proxyPhone: "",
    district: "",
    nidNumber: "",
    matter: null,
    partyName: "",
    partyAddress: "",
    description: "",
    documents: [],
    contactSlot: null,
    contactDay: "",
    contactTime: "",
    specialInstructions: "",
    consentOk: false,
  };
}

/* ------------------------------------------------------------------ *
 *  Drafts — the form the citizen is currently editing. Only one
 *  draft exists at a time per device; saving overwrites it.
 * ------------------------------------------------------------------ */

export function loadDraft(scope?: string): IntakeDraft | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(scopedKey(DRAFTS_KEY, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IntakeDraft>;
    const d = { ...emptyDraft(), ...parsed };
    // Older drafts used fixed slots (friday_morning, evening…) — drop them.
    if (d.contactSlot !== "anytime" && d.contactSlot !== "custom") d.contactSlot = null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(draft: IntakeDraft, scope?: string): boolean {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(scopedKey(DRAFTS_KEY, scope), JSON.stringify(draft));
    return true;
  } catch (err) {
    // Most likely QuotaExceededError. The wizard surfaces this with
    // `intakeStorageQuota` so the citizen can clear an old draft.
    void err;
    return false;
  }
}

export function clearDraft(scope?: string): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(scopedKey(DRAFTS_KEY, scope));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 *  Pending submissions — finished intakes that haven't reached the
 *  authoritative case system yet. Each entry carries the temporary
 *  receipt the citizen was shown.
 * ------------------------------------------------------------------ */

export function loadPending(scope?: string): IntakeSubmission[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(scopedKey(PENDING_KEY, scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntakeSubmission[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writePending(list: IntakeSubmission[], scope?: string): boolean {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(scopedKey(PENDING_KEY, scope), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function enqueueSubmission(
  submission: IntakeSubmission,
  scope?: string,
): IntakeSubmission[] {
  const next = [submission, ...loadPending(scope)];
  return writePending(next, scope) ? next : loadPending(scope);
}

export function removeSubmission(tempReceipt: string, scope?: string): IntakeSubmission[] {
  const next = loadPending(scope).filter((s) => s.tempReceipt !== tempReceipt);
  return writePending(next, scope) ? next : loadPending(scope);
}

/* ------------------------------------------------------------------ *
 *  Network state — read by the wizard so the offline banner can
 *  show/hide and `syncPending()` can decide whether to flush.
 * ------------------------------------------------------------------ */

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/* ------------------------------------------------------------------ *
 *  Receipt id generator. Mirrors the G-YYYY-NNNN format used by the
 *  complaint wizard so the citizen already recognises the shape.
 * ------------------------------------------------------------------ */

export function makeTempReceipt(now: Date = new Date()): string {
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `A-${year}-${random}`;
}

/* ------------------------------------------------------------------ *
 *  Backend sync — STUB.
 *
 *  When the FastAPI backend exposes the canonical `POST /cases`
 *  endpoint, replace the body of `pushIntakeToBackend` with a real
 *  fetch call. The rest of the queue/retry layer stays unchanged:
 *
 *    const res = await fetch("/api/v1/cases", {
 *      method: "POST",
 *      headers: { "Content-Type": "application/json" },
 *      body: JSON.stringify(submission.draft),
 *    });
 *    if (!res.ok) throw new Error("push failed");
 *    const data = (await res.json()) as { caseId: string };
 *    return data.caseId;
 *
 *  For now we resolve successfully after a short delay so the
 *  offline-→-online transition can be demonstrated end-to-end.
 * ------------------------------------------------------------------ */

export async function pushIntakeToBackend(
  submission: IntakeSubmission,
): Promise<{ caseId: string }> {
  // SCHEMA: this is the JSON body the backend should accept.
  // Wire it to `fetch("/api/v1/cases", { method: "POST", ... })`
  // when the endpoint is live.
  void submission;

  await new Promise((resolve) => setTimeout(resolve, 350));

  // The backend will hand us the canonical case id. Until then we
  // promote the temporary receipt so the citizen sees a stable
  // identifier throughout the queue → sync → case transition.
  return { caseId: submission.tempReceipt };
}

/* ------------------------------------------------------------------ *
 *  `syncPending` — flushes the queue one entry at a time. On
 *  success the entry is removed; on failure it stays in the queue
 *  and we re-throw so the caller can schedule a retry.
 *
 *  This is intentionally synchronous-looking (one promise) so the
 *  wizard's `useEffect` can `await` it without race conditions.
 * ------------------------------------------------------------------ */

export async function syncPending(scope?: string): Promise<{
  pushed: number;
  remaining: number;
}> {
  if (!isOnline()) {
    return { pushed: 0, remaining: loadPending(scope).length };
  }
  const queue = loadPending(scope);
  let pushed = 0;
  for (const submission of queue) {
    try {
      await pushIntakeToBackend(submission);
      removeSubmission(submission.tempReceipt, scope);
      pushed += 1;
    } catch {
      // Stop on first failure so order is preserved.
      break;
    }
  }
  return { pushed, remaining: loadPending(scope).length };
}
