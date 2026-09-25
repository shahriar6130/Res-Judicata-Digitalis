import { SCHEMA_VERSION, type DlasDb } from "@/lib/dlas/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_JSON_BYTES = 4 * 1024 * 1024;

type UpstashResponse<T> = { result?: T; error?: string };

function redisKey(): string {
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  return process.env.DLAS_KV_KEY ?? `rjd:dlas:db:v1:${environment}`;
}

function restUrl(): string | null {
  return process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? null;
}

function token(mode: "read" | "write"): string | null {
  if (mode === "read") {
    return process.env.KV_REST_API_READ_ONLY_TOKEN
      ?? process.env.KV_REST_API_TOKEN
      ?? process.env.UPSTASH_REDIS_REST_TOKEN
      ?? null;
  }
  return process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
}

async function command<T>(args: Array<string | number>, mode: "read" | "write"): Promise<T> {
  const url = restUrl();
  const auth = token(mode);
  if (!url || !auth) throw new Error("UPSTASH_NOT_CONFIGURED");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const payload = await response.json() as UpstashResponse<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Upstash request failed (${response.status})`);
  }
  return payload.result as T;
}

function validDatabase(value: unknown): value is DlasDb {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DlasDb>;
  return candidate.v === 1 && candidate.schemaVersion === SCHEMA_VERSION;
}

async function readRemote(): Promise<DlasDb | null> {
  const raw = await command<string | null>(["GET", redisKey()], "read");
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  if (!validDatabase(parsed)) throw new Error("Stored Upstash JSON does not match the DLAS schema");
  return parsed;
}

function unavailable(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const status = message === "UPSTASH_NOT_CONFIGURED" ? 503 : 502;
  return Response.json(
    { ok: false, configured: status !== 503, error: status === 503 ? "Upstash environment variables are not configured" : message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const data = await readRemote();
    return Response.json(
      { ok: true, configured: true, data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unavailable(error);
  }
}

export async function PUT(request: Request) {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
      return Response.json({ ok: false, error: "DLAS JSON exceeds the 4 MiB storage limit" }, { status: 413 });
    }
    const data = JSON.parse(raw) as unknown;
    if (!validDatabase(data)) {
      return Response.json({ ok: false, error: "Invalid DLAS database payload" }, { status: 400 });
    }

    // Prevent a clearly older offline tab from replacing a newer remote snapshot.
    const current = await readRemote();
    const incomingAt = Date.parse(data.updatedAt ?? "") || 0;
    const currentAt = Date.parse(current?.updatedAt ?? "") || 0;
    if (current && currentAt > incomingAt) {
      return Response.json(
        { ok: false, conflict: true, error: "Remote data is newer", data: current },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    await command<string>(["SET", redisKey(), raw], "write");
    return Response.json(
      { ok: true, configured: true, updatedAt: data.updatedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return unavailable(error);
  }
}
