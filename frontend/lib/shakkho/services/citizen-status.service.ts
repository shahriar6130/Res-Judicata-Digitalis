/* ------------------------------------------------------------------ *
 *  CitizenStatusService — derive a safe summary + voice-ready text.
 *
 *  Strips:
 *    - sensitive evidence names
 *    - internal notes
 *    - lawyer performance alerts
 *    - payment info
 *    - third-party contact details
 *
 *  Returns only:
 *    - case id
 *    - current stage
 *    - assigned lawyer (display name only)
 *    - last verified update
 *    - next verified hearing (date + source)
 *    - whether attendance required
 *    - next action
 *    - responsible office / lawyer
 *    - callback requested
 * ------------------------------------------------------------------ */

import type { CaseHearing, LawyerAssignment, PanelLawyer, StoreEnvelope } from "../types";
import { HearingService } from "./hearing.service";
import { CaseProgressService } from "./case-progress.service";
import { TravelChecklistService } from "./travel-checklist.service";

export interface CitizenSafeSummary {
  caseId: string;
  currentStage: string;
  assignedLawyerName?: string;
  lastVerifiedUpdateSummary?: string;
  nextVerifiedHearing?: {
    hearingDate: string;
    court: string;
    purpose?: string;
    source: string;
    verificationStatus: string;
  };
  attendanceRequired?: string;
  nextAction?: string;
  responsibleOffice?: string;
  callbackRequested: boolean;
}

export const CitizenStatusService = {
  deriveSafeSummary(envelope: StoreEnvelope, caseId: string): CitizenSafeSummary {
    const assignment: LawyerAssignment | undefined = (envelope.lawyerAssignments ?? []).find(
      (a) => a.caseId === caseId && a.state === "active",
    );
    const lawyer: PanelLawyer | undefined = assignment
      ? (envelope.panelLawyers ?? []).find((l) => l.lawyerId === assignment.lawyerId)
      : undefined;
    const latest = CaseProgressService.latest(envelope, caseId);
    const allHearings = HearingService.forCase(envelope, caseId);
    const verifiedHearing = allHearings
      .filter((h) => h.verificationStatus === "verified" || h.verificationStatus === "completed")
      .sort((a, b) => new Date(b.hearingDate).getTime() - new Date(a.hearingDate).getTime())[0];
    const upcomingHearing = HearingService.upcoming(envelope, caseId)[0];
    return {
      caseId,
      currentStage: lawyer?.matterCategories?.[0] ?? "in_review",
      assignedLawyerName: lawyer?.fullNameEn ?? lawyer?.fullNameBn,
      lastVerifiedUpdateSummary: latest?.citizenVisibleSummary ?? latest?.summary,
      nextVerifiedHearing: verifiedHearing
        ? {
            hearingDate: verifiedHearing.hearingDate,
            court: verifiedHearing.court,
            source: verifiedHearing.source,
            verificationStatus: verifiedHearing.verificationStatus,
          }
        : upcomingHearing
          ? {
              hearingDate: upcomingHearing.hearingDate,
              court: upcomingHearing.court,
              source: upcomingHearing.source,
              verificationStatus: upcomingHearing.verificationStatus,
            }
          : undefined,
      attendanceRequired: upcomingHearing?.attendanceRequirement,
      nextAction: latest?.nextAction,
      responsibleOffice: upcomingHearing?.court,
      callbackRequested: false,
    };
  },

  safeForVoice(envelope: StoreEnvelope, caseId: string): {
    bn: string;
    en: string;
    travelAdvisory: string | null;
  } {
    const summary = this.deriveSafeSummary(envelope, caseId);
    const nextHearing: CaseHearing | undefined = HearingService.upcoming(envelope, caseId)[0];
    const checklist = nextHearing ? TravelChecklistService.evaluate(envelope, nextHearing) : null;
    const travelAdvisory =
      checklist && !checklist.travelRecommended
        ? "আইনি সহায়তা কার্যালয়ের সাথে যোগাযোগ করে নিশ্চিত হোন। একটি ফলো-আপ অনুরোধ তৈরি করা হয়েছে।"
        : null;
    const nextHearingLine = summary.nextVerifiedHearing
      ? `পরবর্তী শুনানি ${summary.nextVerifiedHearing.hearingDate.slice(0, 10)} তারিখে ${summary.nextVerifiedHearing.court} আদালতে।`
      : "পরবর্তী শুনানির তারিখ এখনও নিশ্চিত করা হয়নি।";
    const lawyerLine = summary.assignedLawyerName ? `আপনার আইনজীবী ${summary.assignedLawyerName}।` : "আপনার জন্য নিযুক্ত আইনজীবী এখনও চূড়ান্ত হয়নি।";
    const travelBn = travelAdvisory ? ` ${travelAdvisory}` : "";
    const travelEn = travelAdvisory ? " Please confirm with the legal-aid office before travelling. A follow-up request has been created." : "";
    return {
      bn: `${lawyerLine} ${nextHearingLine}${travelBn}`,
      en: `${summary.assignedLawyerName ? "Your lawyer is " + summary.assignedLawyerName + "." : "Your assigned lawyer is not yet finalised."} ${summary.nextVerifiedHearing ? "Your next hearing is on " + summary.nextVerifiedHearing.hearingDate.slice(0, 10) + " at " + summary.nextVerifiedHearing.court + "." : "Your next hearing date is not yet verified."}${travelEn}`,
      travelAdvisory,
    };
  },

  worklistForLawyer(envelope: StoreEnvelope, lawyerId: string) {
    return (envelope.lawyerAssignments ?? [])
      .filter((a) => a.lawyerId === lawyerId && a.state === "active")
      .map((a) => ({
        assignment: a,
        summary: this.deriveSafeSummary(envelope, a.caseId),
      }));
  },
};