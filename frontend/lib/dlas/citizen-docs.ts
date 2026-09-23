"use client";

/* ------------------------------------------------------------------ *
 *  Citizen uploads a document the DLAO asked for (or one promised
 *  "for later" at intake) from "My cases" on the web portal.
 *
 *  Writes the shared record in localStorage["dlas.db.v1"]:
 *    documents[i].status → ATTACHED (+ file name, type, size, sha256)
 *    provenance["documents.<id>"] = APPLICANT_STATED / WEB_FORM
 *    audit "document.uploaded" (role applicant)
 *    DOCUMENT_FOLLOW_UP task for that doc → DONE
 *    DOCUMENT_REVIEW task for the DLAO → OPEN
 *  The viewable copy goes to localStorage["dlas.files.v1"] (FileStore).
 * ------------------------------------------------------------------ */

import { FileStore } from "./files";
import { mutate, readDb } from "./store";
import { DOC_TYPES, label } from "./reference";
import { applicationsFor } from "./citizen-view";
import type { AuditEntry, DlasDb, Task } from "./schema";

const CURRENT_KEY = "dlas.citizen.current";
const MAX_BYTES = 10 * 1024 * 1024;
const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

async function sha256(file: Blob): Promise<string | null> {
  try {
    const h = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export const CitizenDocs = {
  /** Throws with a readable message on any problem — the UI shows it; nothing fails silently. */
  async upload(applicationId: string, docId: string, file: File) {
    const citizenId = window.localStorage.getItem(CURRENT_KEY);
    const db0 = readDb();
    const me = db0.citizens.find((c) => c.citizenId === citizenId);
    if (!me) throw new Error("Please log in again");
    const app = applicationsFor(db0, me).find((a) => a.applicationId === applicationId);
    if (!app) throw new Error("This application is not yours");
    const doc = app.data.documents.find((d) => d.docId === docId);
    if (!doc) throw new Error("Unknown document");
    if (doc.status === "ATTACHED") throw new Error("Already submitted");
    if (!(file.type.startsWith("image/") || file.type === "application/pdf")) throw new Error("Please upload a photo or a PDF");
    if (file.size > MAX_BYTES) throw new Error("File is larger than 10 MB");

    const preview = await FileStore.put(docId, file, file.type);
    const hash = await sha256(file);

    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId)!;
      const d = a.data.documents.find((x) => x.docId === docId)!;
      d.status = "ATTACHED";
      d.fileName = file.name;
      d.mimeType = file.type;
      d.sizeBytes = file.size;
      d.sha256 = hash;
      d.preview = preview;
      d.uploadedAt = now();
      d.uploadedVia = "APPLICANT_WEB";
      a.provenance[`documents.${docId}`] = { source: "APPLICANT_STATED", method: "WEB_FORM", confidence: "STATED", by: me.citizenId, at: now(), note: "uploaded by the applicant from My cases" };
      audit(db, a.audit, { actor: me.citizenId, role: "applicant", action: "document.uploaded", detail: { docId, type: d.type, sha256: hash, bytes: file.size, preview, requested: !!d.requested } });
      for (const t of db.tasks) {
        if (t.applicationId !== applicationId || t.status === "DONE" || t.type !== "DOCUMENT_FOLLOW_UP") continue;
        const ctxDoc = (t.context as { docId?: string } | undefined)?.docId;
        if (ctxDoc === docId || (!ctxDoc && a.data.documents.every((x) => x.status === "ATTACHED"))) {
          t.status = "DONE";
          audit(db, a.audit, { actor: "system", role: "system", action: "task.closed", detail: { taskId: t.taskId, type: t.type } });
        }
      }
      const review: Task = {
        taskId: rid("TSK"),
        type: "DOCUMENT_REVIEW",
        applicationId,
        sessionId: a.channel.sessionId,
        assignedRole: "DLAO",
        office: a.routing.office,
        status: "OPEN",
        priority: a.routing.recommendedPriority,
        reason: `Applicant uploaded ${label(DOC_TYPES, d.type, "en")} — review it in step 3`,
        dueAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
        createdAt: now(),
        context: { docId },
      };
      db.tasks.push(review);
      a.taskIds.push(review.taskId);
      audit(db, a.audit, { actor: "system", role: "system", action: "task.created", detail: { taskId: review.taskId, type: review.type } });
      a.version += 1;
      a.updatedAt = now();
      return { preview };
    });
  },
};
