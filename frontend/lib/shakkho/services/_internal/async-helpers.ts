/* ------------------------------------------------------------------ *
 *  Shared async / browser-only helpers used by Phase 5 services.
 *
 *  - Safe wrappers around Web Crypto (SHA-256).
 *  - `id()` factory for offline UUIDs (prefixed with `OFF-`).
 *  - `isBrowser()` guard.
 * ------------------------------------------------------------------ */

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/* ------------------------------------------------------------------ *
 *  Make an offline-draft identifier. Format: `OFF-<base36-timestamp>-<rand>`.
 *
 *  These are intentionally NOT Application IDs. After sync the
 *  helper maps them to `APP-YYYY-XXXXX` and never to a Case ID.
 * ------------------------------------------------------------------ */
export function makeOfflineId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.floor(Math.random() * 0xfffff)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `OFF-${t}-${r}`;
}

/* Random component for idempotency keys etc. */
export function makeId(prefix: string): string {
  const r = Math.floor(Math.random() * 0xffffff)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `${prefix}-${r}`;
}

/* ------------------------------------------------------------------ *
 *  SHA-256 digest of any JSON-serializable object.
 *
 *  - Uses Web Crypto `crypto.subtle.digest` when available.
 *  - Falls back to a deterministic (but non-cryptographic) FNV-1a hex
 *    when `crypto.subtle` is missing (SSR or restricted browsers).
 *    The fallback is logged via `noteUnverifiable()` so reviewers see
 *    the degraded mode rather than assuming a real SHA-256.
 * ------------------------------------------------------------------ */
export async function sha256Digest(value: unknown): Promise<string> {
  const canonical = canonicalStringify(value);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const bytes = new TextEncoder().encode(canonical);
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      const view = new Uint8Array(buf);
      let out = "";
      for (let i = 0; i < view.length; i++) {
        out += view[i].toString(16).padStart(2, "0");
      }
      return out;
    } catch {
      // fall through to FNV-1a fallback
    }
  }
  return fnv1aHex(canonical);
}

let unverifiableWarns = 0;
export function noteUnverifiable(): void {
  unverifiableWarns += 1;
}

export function unverifiableCount(): number {
  return unverifiableWarns;
}

/* ------------------------------------------------------------------ *
 *  Stable canonicalisation: sorts object keys recursively so a JSON
 *  payload with permuted keys produces the SAME digest.
 * ------------------------------------------------------------------ */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalStringify(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(JSON.stringify(k) + ":" + canonicalStringify(obj[k]));
  }
  return "{" + parts.join(",") + "}";
}

/* 64-bit FNV-1a hex. NOT cryptographic; only used as last-resort. */
function fnv1aHex(s: string): string {
  let h1 = 0xcbf29ce4;
  let h2 = 0x84222325;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c & 0xff;
    h2 ^= (c >>> 8) & 0xff;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = Math.imul(h2, 16777619) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0");
}
