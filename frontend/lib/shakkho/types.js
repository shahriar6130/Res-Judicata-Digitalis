"use strict";
/* ------------------------------------------------------------------ *
 *  Shared type surface for the helpline / 16699 workspace.
 *
 *  All services under `lib/shakkho/services/*` import from this file.
 *  Panels consume the same types so a slot filled in the call
 *  simulator shows up unchanged in the right-rail record.
 *
 *  Identifier conventions per architecture §8.4:
 *    - TEMP-xxxxx             offline / draft
 *    - APP-YYYY-XXXXX         submitted application (never case id)
 *    - DLAS-YYYY-XXXXX        accepted case (NOT minted in phase 1)
 *
 *  No LLM call lives in this file. Everything is plain data.
 * ------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVIDENCE_ACCESS_PURPOSES = exports.SafeContactBlockedError = exports.RepresentationOutOfScopeError = void 0;
class RepresentationOutOfScopeError extends Error {
    constructor(message) {
        super(message);
        this.name = "RepresentationOutOfScopeError";
    }
}
exports.RepresentationOutOfScopeError = RepresentationOutOfScopeError;
class SafeContactBlockedError extends Error {
    constructor(message) {
        super(message);
        this.name = "SafeContactBlockedError";
    }
}
exports.SafeContactBlockedError = SafeContactBlockedError;
exports.EVIDENCE_ACCESS_PURPOSES = [
    {
        code: "urgency_review",
        labelBn: "জরুরি পর্যালোচনা",
        labelEn: "Urgency review",
    },
    {
        code: "referral_package_preparation",
        labelBn: "রেফারেল প্যাকেজ প্রস্তুতি",
        labelEn: "Referral-package preparation",
    },
    {
        code: "applicant_requested_correction",
        labelBn: "আবেদনকারী-অনুরোধিত সংশোধন",
        labelEn: "Applicant-requested correction",
    },
    {
        code: "authorized_legal_review",
        labelBn: "অনুমোদিত আইনি পর্যালোচনা",
        labelEn: "Authorized legal review",
    },
    {
        code: "receiving_authority_review",
        labelBn: "প্রাপ্তিস্থান কর্তৃপক্ষের পর্যালোচনা",
        labelEn: "Receiving-authority review",
    },
];
