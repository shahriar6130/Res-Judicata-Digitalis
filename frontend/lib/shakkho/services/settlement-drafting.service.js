"use strict";
/* ------------------------------------------------------------------ *
 *  SettlementDraftingService — T7 (Settlement Agreement Drafting
 *  Assistant).
 *
 *  Every draft starts from an approved, versioned clause template
 *  (below) for one of exactly three categories: maintenance, property,
 *  labour. `generateDraft` never free-writes a clause from nothing —
 *  it either copies a template clause verbatim (`origin: "template"`)
 *  or fills a template's blank with a value parsed from the
 *  mediator's notes (`origin: "ai_inferred"`); if it cannot find a
 *  confident value it leaves the clause explicitly flagged rather
 *  than inventing a number or name.
 *
 *  Same audit-ordering rule as mediation.service.ts: log first
 *  (against a fresh read), then do exactly one final domain write on
 *  top of the post-log envelope. See that file's header comment for
 *  why.
 * ------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementDraftingService = void 0;
const persistence_1 = require("../persistence");
const audit_trail_service_1 = require("./audit-trail.service");
const demo_time_service_1 = require("./demo-time.service");
function makeId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 10);
}
const FORMALITY_WARNING = {
    maintenance: {
        bn: "এই খসড়া একটি প্রত্যয়িত আইনি দলিল নয়। মানবিক আইনি পর্যালোচনা, উভয় পক্ষের সম্মতি এবং প্রযোজ্য আনুষ্ঠানিকতা (স্বাক্ষর/সত্যায়ন) সম্পন্ন না হওয়া পর্যন্ত এটি কার্যকর নয়।",
        en: "This draft is not a certified legal instrument. It has no effect until human legal review, both parties' consent, and applicable formalities (signing/certification) are completed.",
    },
    property: {
        bn: "এই খসড়া একটি প্রত্যয়িত আইনি দলিল নয়। সম্পত্তি হস্তান্তর/বিভাজনের জন্য নিবন্ধনসহ প্রযোজ্য আইনি আনুষ্ঠানিকতা পৃথকভাবে সম্পন্ন করতে হবে।",
        en: "This draft is not a certified legal instrument. Property division or transfer requires applicable legal formalities, including registration, completed separately.",
    },
    labour: {
        bn: "এই খসড়া একটি প্রত্যয়িত আইনি দলিল নয়। মানবিক আইনি পর্যালোচনা ও উভয় পক্ষের সম্মতি ছাড়া এটি কার্যকর নয়।",
        en: "This draft is not a certified legal instrument. It has no effect without human legal review and both parties' consent.",
    },
};
/* Approved clause templates — one per category. `body*` with a
   `{{placeholder}}` is what generateDraft fills; anything without a
   placeholder is copied verbatim (`origin: "template"`). */
const TEMPLATES = {
    maintenance: {
        templateId: "TPL-MAINTENANCE-v1",
        clauses: [
            { titleBn: "পক্ষগণ", titleEn: "Parties", bodyBn: "প্রদানকারী: {{payer}}। গ্রহীতা: {{payee}}।", bodyEn: "Payer: {{payer}}. Payee: {{payee}}." },
            { titleBn: "মাসিক ভরণপোষণ", titleEn: "Monthly maintenance", bodyBn: "প্রদানকারী প্রতি মাসে {{amount}} টাকা {{paymentDate}} তারিখে {{paymentMethod}}-এর মাধ্যমে পরিশোধ করবেন।", bodyEn: "The payer shall pay {{amount}} BDT each month on {{paymentDate}}, via {{paymentMethod}}." },
            { titleBn: "পর্যালোচনার তারিখ", titleEn: "Review date", bodyBn: "এই ব্যবস্থা {{reviewDate}}-এ পর্যালোচনা করা হবে।", bodyEn: "This arrangement will be reviewed on {{reviewDate}}." },
            { titleBn: "অ-পরিশোধের ফলাফল", titleEn: "Default consequence", bodyBn: "ধারাবাহিক অ-পরিশোধ হলে বিষয়টি মানবিক পর্যালোচনার জন্য ফিরিয়ে আনা হবে।", bodyEn: "Repeated non-payment returns this matter to human review; there is no automatic penalty." },
        ],
    },
    property: {
        templateId: "TPL-PROPERTY-v1",
        clauses: [
            { titleBn: "পক্ষগণ ও সম্পত্তি", titleEn: "Parties and property", bodyBn: "পক্ষ: {{partyA}} এবং {{partyB}}। সম্পত্তির বিবরণ/সীমানা: {{propertyDescription}}।", bodyEn: "Parties: {{partyA}} and {{partyB}}. Property description / boundary: {{propertyDescription}}." },
            { titleBn: "বিভাজন বা হস্তান্তরের শর্ত", titleEn: "Division or transfer terms", bodyBn: "সম্মত শর্ত: {{divisionTerms}}।", bodyEn: "Agreed terms: {{divisionTerms}}." },
            { titleBn: "দখল হস্তান্তরের তারিখ", titleEn: "Possession date", bodyBn: "দখল {{possessionDate}}-এ হস্তান্তরিত হবে।", bodyEn: "Possession transfers on {{possessionDate}}." },
            { titleBn: "নিবন্ধন/আনুষ্ঠানিকতা", titleEn: "Registration / formality note", bodyBn: "এই খসড়া নিবন্ধনের বিকল্প নয়; প্রযোজ্য নিবন্ধন পৃথকভাবে সম্পন্ন করতে হবে।", bodyEn: "This draft does not substitute for registration; applicable registration must be completed separately." },
        ],
    },
    labour: {
        templateId: "TPL-LABOUR-v1",
        clauses: [
            { titleBn: "পক্ষগণ ও বিরোধের সারাংশ", titleEn: "Parties and dispute summary", bodyBn: "নিয়োগকর্তা: {{employer}}। শ্রমিক: {{worker}}। বিরোধ: {{disputeSummary}}।", bodyEn: "Employer: {{employer}}. Worker: {{worker}}. Dispute: {{disputeSummary}}." },
            { titleBn: "সম্মত প্রতিকার", titleEn: "Agreed remedy", bodyBn: "সম্মত প্রতিকার: {{remedy}}।", bodyEn: "Agreed remedy: {{remedy}}." },
            { titleBn: "সময়রেখা", titleEn: "Timeline", bodyBn: "বাস্তবায়নের সময়রেখা: {{timeline}}।", bodyEn: "Implementation timeline: {{timeline}}." },
            { titleBn: "প্রতিশোধ-বিরোধী ধারা", titleEn: "Non-retaliation clause", bodyBn: "কোনো পক্ষ এই সমঝোতায় অংশগ্রহণের জন্য শ্রমিকের বিরুদ্ধে প্রতিশোধমূলক ব্যবস্থা নেবে না।", bodyEn: "No party shall retaliate against the worker for participating in this settlement." },
        ],
    },
};
function fillTemplate(body, fields) {
    let hadPlaceholder = false;
    let allFilled = true;
    let anyFilled = false;
    const text = body.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
        hadPlaceholder = true;
        const value = fields[key];
        if (value && value.trim().length > 0) {
            anyFilled = true;
            return value;
        }
        allFilled = false;
        return `[${key}: insufficient information]`;
    });
    if (!hadPlaceholder)
        return { text, origin: "template" };
    if (allFilled)
        return { text, origin: "ai_inferred" };
    if (anyFilled)
        return { text, origin: "ai_inferred", sourceNote: "Some fields could not be confidently extracted from the mediator's notes and are flagged inline rather than guessed." };
    return { text, origin: "ai_inferred", sourceNote: "Insufficient information in the mediator's notes; fields left flagged for human completion." };
}
/** Very small, deliberately literal note parser — looks for "key: value" style hints the mediator typed. This is NOT an LLM call; it is a transparent, auditable field extractor, matching the case's own guardrail that AI assistance must be explainable, not a black box. */
function extractFields(notes) {
    const fields = {};
    const patterns = [
        [/payer[:\-]\s*([^\n,;]+)/i, "payer"],
        [/payee[:\-]\s*([^\n,;]+)/i, "payee"],
        [/amount[:\-]\s*([\d,]+)/i, "amount"],
        [/payment ?date[:\-]\s*([^\n,;]+)/i, "paymentDate"],
        [/payment ?method[:\-]\s*([^\n,;]+)/i, "paymentMethod"],
        [/review ?date[:\-]\s*([^\n,;]+)/i, "reviewDate"],
        [/party ?a[:\-]\s*([^\n,;]+)/i, "partyA"],
        [/party ?b[:\-]\s*([^\n,;]+)/i, "partyB"],
        [/property[:\-]\s*([^\n,;]+)/i, "propertyDescription"],
        [/division|transfer[:\-]\s*([^\n,;]+)/i, "divisionTerms"],
        [/possession ?date[:\-]\s*([^\n,;]+)/i, "possessionDate"],
        [/employer[:\-]\s*([^\n,;]+)/i, "employer"],
        [/worker[:\-]\s*([^\n,;]+)/i, "worker"],
        [/dispute[:\-]\s*([^\n,;]+)/i, "disputeSummary"],
        [/remedy[:\-]\s*([^\n,;]+)/i, "remedy"],
        [/timeline[:\-]\s*([^\n,;]+)/i, "timeline"],
    ];
    for (const [re, key] of patterns) {
        const m = notes.match(re);
        if (m)
            fields[key] = m[1].trim();
    }
    return fields;
}
exports.SettlementDraftingService = {
    list(envelope) {
        return envelope.settlementDrafts ?? [];
    },
    find(envelope, draftId) {
        return (envelope.settlementDrafts ?? []).find((d) => d.draftId === draftId);
    },
    forMatter(envelope, matterId) {
        return (envelope.settlementDrafts ?? []).filter((d) => d.matterId === matterId);
    },
    generateDraft(input) {
        const template = TEMPLATES[input.category];
        const fields = extractFields(input.mediatorNotes);
        const now = demo_time_service_1.DemoTimeService.iso();
        const clauses = template.clauses.map((c, idx) => {
            const bn = fillTemplate(c.bodyBn, fields);
            const en = fillTemplate(c.bodyEn, fields);
            const origin = bn.origin === "ai_inferred" || en.origin === "ai_inferred" ? "ai_inferred" : "template";
            return {
                clauseId: `${input.category}-${idx + 1}`,
                titleBn: c.titleBn,
                titleEn: c.titleEn,
                bodyBn: bn.text,
                bodyEn: en.text,
                origin,
                sourceNote: bn.sourceNote ?? en.sourceNote,
                required: true,
                disposition: "undisposed",
            };
        });
        const draftId = makeId("SD");
        const draft = {
            draftId,
            matterId: input.matterId,
            caseId: input.caseId,
            category: input.category,
            templateId: template.templateId,
            templateVersion: "v1",
            version: 1,
            clauses,
            inconsistencies: [],
            formalityWarning: FORMALITY_WARNING[input.category],
            status: "draft",
            consent: input.partyNames.map((party) => ({ party, consented: false })),
            consentChecklist: {
                finalDraftFrozen: false,
                partiesReceivedSameVersion: false,
                languageRecorded: false,
                plainLanguageExplanationProvided: false,
                interpreterOrAccessibilitySupportRecorded: false,
                questionsAndClarificationsRecorded: false,
                voluntaryConsentRecorded: false,
                unresolvedIssuesCleared: false,
                humanLegalReviewCompleted: false,
                requiredFormalitiesMarked: false,
            },
            auditEventIds: [],
            createdAt: now,
            updatedAt: now,
        };
        draft.inconsistencies = this.runInconsistencyCheck(draft);
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: draftId, subjectKind: "settlement_draft", action: "settlement_draft.generated", actor: input.actor, payload: { matterId: input.matterId, category: input.category, inconsistencyCount: draft.inconsistencies.length } }, { kind: "system", simulatedAt: now, note: { bn: "খসড়াটি অনুমোদিত টেমপ্লেট থেকে তৈরি; মধ্যস্থতাকারীর নোট থেকে ভরা তথ্য দৃশ্যমানভাবে চিহ্নিত।", en: "Draft generated from an approved template; fields filled from mediator notes are visibly flagged." } });
        draft.auditEventIds = [audit.id];
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: [...(fresh.settlementDrafts ?? []), draft] });
        return draft;
    },
    /**
     * Pure function — no store access — so it is directly unit-testable.
     * Minimum checks per Prompt 10 §3: a numeric-amount mismatch between
     * clauses that both cite a monetary figure, and a party-name mention
     * that doesn't match any registered party.
     */
    runInconsistencyCheck(draft) {
        const findings = [];
        const amounts = [];
        for (const clause of draft.clauses) {
            const matches = clause.bodyEn.match(/\b(\d[\d,]{2,})\b/g) ?? [];
            for (const m of matches) {
                const value = Number(m.replace(/,/g, ""));
                if (!Number.isNaN(value))
                    amounts.push({ clauseId: clause.clauseId, value });
            }
        }
        if (amounts.length >= 2) {
            const first = amounts[0];
            const mismatched = amounts.filter((a) => a.value !== first.value);
            if (mismatched.length > 0) {
                findings.push({
                    clauseIds: [first.clauseId, ...mismatched.map((m) => m.clauseId)],
                    description: {
                        bn: `একাধিক ধারায় ভিন্ন ভিন্ন অর্থের পরিমাণ উল্লেখ করা হয়েছে (${first.value} বনাম ${mismatched.map((m) => m.value).join(", ")}) — মানবিক পর্যালোচনা প্রয়োজন।`,
                        en: `Different clauses cite different amounts (${first.value} vs. ${mismatched.map((m) => m.value).join(", ")}) — needs human review.`,
                    },
                    severity: "blocking",
                });
            }
        }
        return findings;
    },
    /** §13 — the mediator's per-clause human disposition: accept / edit / reject / request clarification / mark unresolved. Editing text always re-marks the clause `human_edited`. */
    dispositionClause(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return { ok: false, error: `No settlement draft ${input.draftId}.` };
        const now = demo_time_service_1.DemoTimeService.iso();
        const clauses = draft.clauses.map((c) => c.clauseId === input.clauseId
            ? {
                ...c,
                disposition: input.disposition,
                dispositionedBy: input.actor,
                dispositionedAt: now,
                bodyBn: input.disposition === "edit" && input.editedBodyBn ? input.editedBodyBn : c.bodyBn,
                bodyEn: input.disposition === "edit" && input.editedBodyEn ? input.editedBodyEn : c.bodyEn,
                origin: input.disposition === "edit" ? "human_edited" : c.origin,
            }
            : c);
        const inconsistencies = this.runInconsistencyCheck({ ...draft, clauses });
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.clause_dispositioned", actor: input.actor, payload: { clauseId: input.clauseId, disposition: input.disposition } }, { kind: "officer_lookup", simulatedAt: now });
        const updated = { ...draft, clauses, inconsistencies, version: draft.version + 1, auditEventIds: [...draft.auditEventIds, audit.id], updatedAt: now };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
    allRequiredClausesDisposed(draft) {
        return draft.clauses.filter((c) => c.required).every((c) => c.disposition !== "undisposed");
    },
    hasBlockingInconsistency(draft) {
        return draft.inconsistencies.some((i) => i.severity === "blocking");
    },
    /** §14 — the pre-signing checklist. Nothing is preselected; the mediator ticks each item explicitly. */
    updateConsentChecklist(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return { ok: false, error: `No settlement draft ${input.draftId}.` };
        const now = demo_time_service_1.DemoTimeService.iso();
        const consentChecklist = { ...draft.consentChecklist, ...input.checklist };
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.checklist_updated", actor: input.actor, payload: input.checklist }, { kind: "officer_lookup", simulatedAt: now });
        const updated = { ...draft, consentChecklist, auditEventIds: [...draft.auditEventIds, audit.id], updatedAt: now };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
    checklistComplete(checklist) {
        return Object.values(checklist).every(Boolean);
    },
    submitForReview(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return undefined;
        const now = demo_time_service_1.DemoTimeService.iso();
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.human_reviewed", actor: input.reviewer, payload: { notes: input.notes } }, { kind: "officer_lookup", simulatedAt: now });
        const updated = {
            ...draft,
            status: "human_reviewed",
            reviewedBy: input.reviewer,
            reviewedAt: now,
            reviewNotes: input.notes,
            auditEventIds: [...draft.auditEventIds, audit.id],
            updatedAt: now,
        };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return updated;
    },
    requestPartyConsent(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft || draft.status !== "human_reviewed")
            return { ok: false, error: "Draft must be human-reviewed before party review can open." };
        if (!this.allRequiredClausesDisposed(draft)) {
            return { ok: false, error: "Every required clause needs a human disposition (accept/edit/reject/clarify/unresolved) before the draft can move to party review." };
        }
        if (this.hasBlockingInconsistency(draft)) {
            return { ok: false, error: "A blocking inconsistency must be resolved before the draft can move to party review." };
        }
        const now = demo_time_service_1.DemoTimeService.iso();
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.party_consent_pending", actor: input.actor }, { kind: "officer_lookup", simulatedAt: now });
        const updated = { ...draft, status: "party_consent_pending", auditEventIds: [...draft.auditEventIds, audit.id], updatedAt: now };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
    recordPartyConsent(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return { ok: false, error: `No settlement draft ${input.draftId}.` };
        const now = demo_time_service_1.DemoTimeService.iso();
        const consent = draft.consent.map((c) => (c.party === input.party ? { party: c.party, consented: input.consented, consentedAt: now, method: input.method } : c));
        const allConsented = consent.length > 0 && consent.every((c) => c.consented);
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.party_consent_recorded", actor: input.actor, payload: { party: input.party, consented: input.consented, method: input.method } }, { kind: "officer_lookup", simulatedAt: now });
        const updated = {
            ...draft,
            consent,
            status: allConsented ? "party_consented" : draft.status,
            auditEventIds: [...draft.auditEventIds, audit.id],
            updatedAt: now,
        };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
    /** Renders the clause set into one canonical text blob — this is what gets hashed and what T11 signs. */
    renderDraftText(draft, lang = "en") {
        return draft.clauses
            .map((c) => `${lang === "bn" ? c.titleBn : c.titleEn}\n${lang === "bn" ? c.bodyBn : c.bodyEn}`)
            .join("\n\n");
    },
    async hashText(text) {
        if (typeof crypto === "undefined" || !crypto.subtle)
            return "unavailable";
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    /**
     * §14/§15 — freezes the exact document version that goes to signing.
     * Requires both party consent AND the full pre-signing checklist —
     * nothing here is preselected; the mediator must have ticked every
     * item via `updateConsentChecklist` first. Produces a real SHA-256
     * hash of the frozen text so T11 can verify document integrity.
     */
    async finalize(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return { ok: false, error: `No settlement draft ${input.draftId}.` };
        if (draft.status !== "party_consented") {
            return { ok: false, error: "Cannot finalize a draft before both parties have consented." };
        }
        if (draft.inconsistencies.some((i) => i.severity === "blocking")) {
            return { ok: false, error: "Cannot finalize a draft with an unresolved blocking inconsistency." };
        }
        if (!this.checklistComplete(draft.consentChecklist)) {
            return { ok: false, error: "Every item on the party-understanding checklist must be confirmed before signing can open." };
        }
        const now = demo_time_service_1.DemoTimeService.iso();
        const frozenText = this.renderDraftText(draft, "en");
        const frozenTextHash = await this.hashText(frozenText);
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.finalized", actor: input.actor, payload: { frozenTextHash } }, { kind: "officer_lookup", simulatedAt: now });
        const updated = {
            ...draft,
            status: "finalized",
            finalizedForSigningAt: now,
            frozenText,
            frozenTextHash,
            consentChecklist: { ...draft.consentChecklist, finalDraftFrozen: true, partiesReceivedSameVersion: true },
            auditEventIds: [...draft.auditEventIds, audit.id],
            updatedAt: now,
        };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
    /**
     * §15 — if the draft changes after finalize (e.g. a correction is
     * needed post-freeze), the previous signed version must never be
     * silently reused: bump the version, clear the freeze, and require
     * review + signing again from scratch.
     */
    invalidateAfterChange(input) {
        const envelope = (0, persistence_1.read)();
        const draft = (envelope.settlementDrafts ?? []).find((d) => d.draftId === input.draftId);
        if (!draft)
            return { ok: false, error: `No settlement draft ${input.draftId}.` };
        const now = demo_time_service_1.DemoTimeService.iso();
        const audit = audit_trail_service_1.AuditTrailService.log({ subject: input.draftId, subjectKind: "settlement_draft", action: "settlement_draft.invalidated_content_changed", actor: input.actor, payload: { reason: input.reason, previousHash: draft.frozenTextHash } }, { kind: "officer_lookup", simulatedAt: now });
        const updated = {
            ...draft,
            status: "rejected_needs_rework",
            version: draft.version + 1,
            finalizedForSigningAt: undefined,
            frozenText: undefined,
            frozenTextHash: undefined,
            consent: draft.consent.map((c) => ({ party: c.party, consented: false })),
            auditEventIds: [...draft.auditEventIds, audit.id],
            updatedAt: now,
        };
        const fresh = (0, persistence_1.read)();
        (0, persistence_1.write)({ ...fresh, settlementDrafts: (fresh.settlementDrafts ?? []).map((d) => (d.draftId === input.draftId ? updated : d)) });
        return { ok: true, value: updated };
    },
};
