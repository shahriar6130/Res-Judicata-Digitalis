/* ------------------------------------------------------------------ *
 *  ONE validator for every door. The Web form, the UDC form, the IVR
 *  script and the USSD menu all call this same function, so a
 *  submission is either valid everywhere or nowhere.
 * ------------------------------------------------------------------ */

import type { ApplicationData, IntakeSession, ValidationResult } from "./schema";
import { DISTRICTS, MATTERS, normalizePhone } from "./reference";

type Issue = { path: string; code: string; message: string };

export function validateApplication(
  data: ApplicationData,
  identity: IntakeSession["identity"],
  channel: IntakeSession["channel"],
): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const need = (path: string, ok: boolean, message: string) => {
    if (!ok) errors.push({ path, code: "REQUIRED", message });
  };

  const a = data.applicant;
  need("identity.verified", identity.verified, "Phone / identity not verified");
  need("applicant.fullName", !!a.fullName && a.fullName.trim().length >= 2, "Applicant name is required");
  if (data.filedBy.kind === "REPRESENTATIVE" && !a.phone) {
    warnings.push({ path: "applicant.phone", code: "APPLICANT_PHONE_UNKNOWN", message: "Applicant's own phone not given — contact goes through the safe channel" });
  } else {
    need("applicant.phone", !!normalizePhone(a.phone), "A valid 11-digit mobile number (01XXXXXXXXX) is required");
  }
  if (a.nidNumber) {
    const digits = a.nidNumber.replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c))).replace(/\D/g, "");
    if (![10, 13, 17].includes(digits.length)) {
      errors.push({ path: "applicant.nidNumber", code: "FORMAT", message: "NID number must have 10, 13 or 17 digits" });
    }
  } else {
    warnings.push({ path: "applicant.nidNumber", code: "NID_NOT_PROVIDED", message: "No NID number — the DLAO will verify identity another way" });
  }
  if (a.identityDocumentUnavailable) {
    warnings.push({
      path: "applicant.identityDocumentUnavailable",
      code: "LOCAL_IDENTITY_VERIFICATION_SENT",
      message: "Applicant has no necessary identity document — local government representative verification requested",
    });
  }
  need(
    "applicant.district",
    !!a.district && DISTRICTS.some((d) => d.code === a.district),
    "District is required",
  );
  need(
    "matter.category",
    !!data.matter.category && MATTERS.some((m) => m.code === data.matter.category),
    "Type of problem is required",
  );
  need(
    "matter.summary",
    !!data.matter.summary && data.matter.summary.trim().length >= 10,
    "Describe the problem in at least 10 characters",
  );
  need("safeContact.method", !!data.safeContact.method, "How we may safely contact you is required");
  need("safeContact.safeTime", !!data.safeContact.safeTime, "A safe time to contact is required");
  if (data.safeContact.method === "CALL" || data.safeContact.method === "SMS") {
    need("safeContact.phone", !!normalizePhone(data.safeContact.phone), "A valid safe contact number is required");
  }
  need("consent.dataProcessing", data.consent.dataProcessing, "Consent to process this application is required");
  need("consent.method", !!data.consent.method, "Consent capture method missing");

  // Representative filing (Ripon for Moyuri)
  if (data.filedBy.kind === "REPRESENTATIVE") {
    need("filedBy.name", !!data.filedBy.name, "Representative name is required");
    need("filedBy.relation", !!data.filedBy.relation, "Representative relation is required");
    need("filedBy.phone", !!normalizePhone(data.filedBy.phone), "Representative phone is required");
    warnings.push({
      path: "filedBy",
      code: "APPLICANT_CONFIRMATION_PENDING",
      message: "Filed by a representative — applicant must later confirm in their own voice",
    });
  }

  // Assisted doors must record who assisted and the free-service notice
  if (channel === "UDC_ASSISTED") {
    need("filedBy.operatorId", !!data.filedBy.operatorId, "UDC operator id is required");
    need("freeServiceNoticeAcknowledged", data.freeServiceNoticeAcknowledged, "Free-service notice must be read to the applicant");
    need("consent.readBackConfirmed", data.consent.readBackConfirmed, "Consent must be read back to the applicant");
    if (a.phoneOwnedByApplicant === false) {
      warnings.push({
        path: "applicant.phone",
        code: "NON_APPLICANT_PHONE",
        message: "Phone belongs to someone else (UDC/shop) — safer applicant-controlled contact needed",
      });
    }
  }
  if (
    data.matter.translation &&
    (!data.matter.summaryOriginal || data.matter.summaryOriginal.trim().length === 0)
  ) {
    errors.push({
      path: "matter.summaryOriginal",
      code: "REQUIRED",
      message: "When translated, the applicant's original words must be kept",
    });
  }

  // Soft checks
  if (data.urgency.flags.length > 0 || data.urgency.selfReportedUrgent) {
    warnings.push({ path: "urgency", code: "URGENT_REVIEW", message: "Urgency signals — human safety review will be created" });
  }
  const missingDocs = data.documents.filter((d) => d.status !== "ATTACHED");
  if (missingDocs.length) {
    warnings.push({
      path: "documents",
      code: "DOCUMENTS_PENDING",
      message: `${missingDocs.length} document(s) to be submitted later`,
    });
  }

  return {
    valid: errors.length === 0,
    missing: errors.filter((e) => e.code === "REQUIRED").map((e) => e.path),
    errors,
    warnings,
  };
}
