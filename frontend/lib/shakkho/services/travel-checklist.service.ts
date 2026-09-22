/* ------------------------------------------------------------------ *
 *  TravelChecklistService — travel-prevention safeguard before
 *  telling a citizen to attend a hearing.
 *
 *  Every "next hearing" disclosure (voice status + citizen-safe
 *  view + DLAO overview) passes through `evaluate(hearing)`:
 *
 *    - hearing.verificationStatus === "verified"
 *    - source recorded and not "applicant_reported" (unverified)
 *    - attendance requirement recorded (not "unknown")
 *    - responsible lawyer confirmed
 *    - current progress update exists
 *    - safe-comms plan exists
 *
 *  If any item fails, `travelRecommended: false` and a follow-up task
 *  is created.  This protects citizens from travelling for hearings
 *  that may have been rescheduled, cancelled, or never confirmed.
 * ------------------------------------------------------------------ */

import type { CaseHearing, StoreEnvelope } from "../types";
import { DlaoTaskService } from "./dlao-task.service";
import { DemoTimeService } from "./demo-time.service";
import { CaseProgressService } from "./case-progress.service";

export interface TravelChecklistResult {
  verified: boolean;
  sourceRecorded: boolean;
  attendanceRecorded: boolean;
  responsibleConfirmed: boolean;
  updateCurrent: boolean;
  safeCommsCompleted: boolean;
  travelRecommended: boolean;
  followUpTaskCreated: boolean;
  followUpTaskId?: string;
  reasons: string[];
}

export const TravelChecklistService = {
  evaluate(envelope: StoreEnvelope, hearing: CaseHearing): TravelChecklistResult {
    const verified = hearing.verificationStatus === "verified" || hearing.verificationStatus === "completed";
    const sourceRecorded = !!hearing.source && hearing.source !== "applicant_reported";
    const attendanceRecorded = !!hearing.attendanceRequirement && hearing.attendanceRequirement !== "unknown";
    const responsibleConfirmed = activeContext(envelope, hearing.caseId) !== undefined;
    const latest = CaseProgressService.latest(envelope, hearing.caseId);
    const updateCurrent = !!latest;
    const safeComms = (envelope.safeContactPlans ?? []).some((p) => p.applicationId === findAppIdForCase(envelope, hearing.caseId));
    const safeCommsCompleted = safeComms;
    const allOk = verified && sourceRecorded && attendanceRecorded && responsibleConfirmed && updateCurrent && safeCommsCompleted;
    const reasons: string[] = [];
    if (!verified) reasons.push("Hearing not yet verified");
    if (!sourceRecorded) reasons.push("Hearing source not recorded or only applicant-reported");
    if (!attendanceRecorded) reasons.push("Attendance requirement not recorded");
    if (!responsibleConfirmed) reasons.push("Responsible person / assigned lawyer not yet confirmed");
    if (!updateCurrent) reasons.push("No current progress update on file");
    if (!safeCommsCompleted) reasons.push("Safe communication plan not yet configured");
    let followUpTaskId: string | undefined;
    let followUpTaskCreated = false;
    if (!allOk) {
      const task = DlaoTaskService.createTask({
        subject: hearing.caseId,
        subjectKind: "travel_verification",
        reason: "travel_checklist_failed",
        priority: "high",
        summary: `Travel-prevention follow-up for hearing ${hearing.hearingId}`,
        details: { reasons, hearingId: hearing.hearingId },
        dueAt: DemoTimeService.iso(),
        type: "verification_task_hearing_date",
        actor: "system",
      });
      followUpTaskId = task.taskId;
      followUpTaskCreated = true;
    }
    return {
      verified,
      sourceRecorded,
      attendanceRecorded,
      responsibleConfirmed,
      updateCurrent,
      safeCommsCompleted,
      travelRecommended: allOk,
      followUpTaskCreated,
      followUpTaskId,
      reasons,
    };
  },
};

function activeContext(envelope: StoreEnvelope, caseId: string) {
  return (envelope.lawyerAssignments ?? []).find((a) => a.caseId === caseId && a.state === "active");
}

function findAppIdForCase(envelope: StoreEnvelope, caseId: string): string | undefined {
  const assignment = (envelope.lawyerAssignments ?? []).find((a) => a.caseId === caseId);
  return assignment?.applicationId;
}