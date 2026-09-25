"use client";

import { CitizenAuth } from "./citizen-auth";
import { applicationsFor } from "./citizen-view";
import { DlaoAuth, officerCanAccessApplication, openOfficeTask } from "./dlao";
import { mutate, readDb } from "./store";
import { normalizePhone } from "./reference";
import type { AuditEntry, DlasDb, LawyerChangeRequest } from "./schema";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function audit(db: DlasDb, list: AuditEntry[], e: Omit<AuditEntry, "seq" | "at">) {
  db.counters.auditSeq += 1;
  list.push({ seq: db.counters.auditSeq, at: now(), ...e });
}

export const LawyerChangeService = {
  request(applicationId: string) {
    const me = CitizenAuth.current();
    if (!me) throw new Error("Please log in first");
    if (!applicationsFor(readDb(), me).some((a) => a.applicationId === applicationId)) throw new Error("This case is not yours");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId)!;
      const matter = a.lawyer;
      if (!matter?.assignments.some((x) => x.status === "ACCEPTED")) throw new Error("There is no assigned lawyer to change");
      const requests = (matter.changeRequests ??= []);
      if (requests.some((x) => x.status === "PENDING")) throw new Error("Your request is already with the DLAO");
      const request: LawyerChangeRequest = {
        requestId: rid("LCR"), requestedAt: now(), requestedBy: me.citizenId,
        reason: "ALLEGED_ILLEGAL_CONDUCT", status: "PENDING",
        decidedAt: null, decidedBy: null, decidedByName: null,
      };
      requests.push(request);
      const task = openOfficeTask(db, a, "LAWYER_CHANGE_REQUEST", `Citizen requests a lawyer change due to alleged illegal conduct on ${a.caseId ?? a.applicationId}`, 24, "DLAO", { requestId: request.requestId });
      task.priority = "HIGH";
      audit(db, a.audit, { actor: me.citizenId, role: "applicant", caseId: a.caseId ?? a.applicationId, action: "lawyer.change_requested", detail: { requestId: request.requestId, reason: request.reason, taskId: task.taskId } });
      a.version += 1;
      a.updatedAt = now();
      return request;
    });
  },

  approve(applicationId: string, requestId: string) {
    const officer = DlaoAuth.current();
    if (!officer) throw new Error("Officer login required");
    return mutate((db) => {
      const a = db.applications.find((x) => x.applicationId === applicationId);
      if (!a || !officerCanAccessApplication(a, officer)) throw new Error("This case is outside your office");
      const request = a.lawyer?.changeRequests?.find((x) => x.requestId === requestId);
      if (!request || request.status !== "PENDING") throw new Error("No pending lawyer-change request");
      Object.assign(request, { status: "APPROVED", decidedAt: now(), decidedBy: officer.officerId, decidedByName: officer.name });
      for (const task of db.tasks) {
        if (task.applicationId === applicationId && task.type === "LAWYER_CHANGE_REQUEST" && task.status !== "DONE" && task.context?.requestId === requestId) task.status = "DONE";
      }
      audit(db, a.audit, { actor: officer.officerId, role: "dlao", caseId: a.caseId ?? a.applicationId, action: "lawyer.change_request_approved", detail: { requestId, officer: officer.name } });
      const to = normalizePhone(a.data.safeContact.phone) ?? normalizePhone(a.data.applicant.phone);
      if (to) db.outbox.push({
        msgId: rid("SMS"), kind: "SMS_CONFIRMATION", to,
        body: a.data.safeContact.neutralWordingRequired
          ? `Your application for reference ${a.caseId ?? a.applicationId} is approved. You will be notified soon with an update.`
          : `DLAS legal aid: your lawyer-change application for ${a.caseId ?? a.applicationId} is approved. You will be notified soon with an update.`,
        sessionId: a.channel.sessionId, applicationId, simulated: true,
        status: a.data.safeContact.smsAllowed ? "DELIVERED" : "SUPPRESSED_UNSAFE", at: now(),
        context: { kind: "LAWYER_CHANGE_APPROVED", requestId },
      });
      a.version += 1;
      a.updatedAt = now();
      return request;
    });
  },
};
