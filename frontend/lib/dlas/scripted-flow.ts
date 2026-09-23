/* ------------------------------------------------------------------ *
 *  One scripted intake flow for the two screenless / low-data doors:
 *
 *    IVR 16699  → prompts are spoken, answers are keypad (DTMF) or
 *                 voice (speech-to-text, simulated)
 *    USSD *16699# → prompts are 160-char screens, answers are menu
 *                 digits or short typed text
 *
 *  Both render the SAME nodes, ask the SAME questions in the SAME
 *  order and call the SAME IntakeGateway functions, so the JSON they
 *  produce is identical in shape to the Web and UDC forms.
 * ------------------------------------------------------------------ */

import { IntakeGateway, type CaptureTag } from "./gateway";
import {
  CONTACT_METHODS,
  DISTRICTS,
  GENDERS,
  MATTERS,
  RELATIONS,
  REQUIRED_DOCS,
  DOC_TYPES,
  SAFE_TIMES,
  byIndex,
  label,
  normalizePhone,
  type Option,
} from "./reference";
import type { IntakeSession } from "./schema";

export type FlowMode = "IVR" | "USSD";
export type Lang = "bn" | "en";

export interface FlowCtx {
  mode: FlowMode;
  lang: Lang;
  sessionId: string;
}

export type InputKind = "choice" | "digits" | "text";

export interface FlowNode {
  id: string;
  input: InputKind;
  prompt: (ctx: FlowCtx, s: IntakeSession) => string;
  options?: (ctx: FlowCtx, s: IntakeSession) => { key: string; label: string }[];
  /** Returns the next node id, or an error message to re-prompt. */
  handle: (value: string, ctx: FlowCtx, s: IntakeSession) => { next: string } | { error: string };
  terminal?: boolean;
}

const t = (ctx: FlowCtx, bn: string, en: string) => (ctx.lang === "bn" ? bn : en);

function menu<T extends string>(ctx: FlowCtx, list: Option<T>[]) {
  return list.map((o, i) => ({ key: String(i + 1), label: o.label[ctx.lang] }));
}

const isRep = (s: IntakeSession) => s.draft.filedBy.kind === "REPRESENTATIVE";

/** Provenance tag for an answer given through this door. */
function tagFor(ctx: FlowCtx, s: IntakeSession, kind: InputKind): CaptureTag {
  const by = isRep(s) ? `rep:${s.identity.phone ?? "unknown"}` : "applicant";
  if (ctx.mode === "IVR") {
    if (kind === "text") {
      // Speech-to-text output is AI-inferred until read back and confirmed.
      return { source: "AI_INFERRED", method: "IVR_VOICE", by, note: "simulated speech-to-text" };
    }
    return { source: isRep(s) ? "REPRESENTATIVE_REPORTED" : "APPLICANT_STATED", method: "IVR_DTMF", by };
  }
  return {
    source: isRep(s) ? "REPRESENTATIVE_REPORTED" : "APPLICANT_STATED",
    method: kind === "choice" ? "USSD_MENU" : "USSD_TEXT",
    by,
  };
}

/** After a read-back "1 = correct": who confirmed decides the provenance. */
function confirmReadBack(ctx: FlowCtx, s: IntakeSession, path: string, value: string) {
  const method = ctx.mode === "IVR" ? "IVR_DTMF" : "USSD_MENU";
  if (isRep(s)) {
    // A representative's confirmation is still the representative's report — never the applicant's.
    IntakeGateway.capture(
      s.sessionId,
      setPath(path, value),
      { source: "REPRESENTATIVE_REPORTED", method, by: `rep:${s.identity.phone}`, note: "read back to representative" },
    );
  } else {
    IntakeGateway.confirm(s.sessionId, [path], "applicant", method);
  }
}

function setPath(path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const root: Record<string, unknown> = {};
  let cur = root;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value;
    else cur = cur[p] = {} as Record<string, unknown>;
  });
  return root;
}

/** Which node collects a given validator path (so a failed submit jumps back there). */
export const PATH_TO_NODE: Record<string, string> = {
  "applicant.fullName": "NAME",
  "applicant.phone": "APPLICANT_PHONE",
  "applicant.district": "DISTRICT",
  "applicant.nidNumber": "NID",
  "matter.category": "MATTER",
  "matter.summary": "SUMMARY",
  "safeContact.method": "SAFE_CALL",
  "safeContact.phone": "SAFE_NUMBER",
  "safeContact.safeTime": "SAFE_TIME",
  "consent.dataProcessing": "CONSENT",
  "consent.method": "CONSENT",
  "filedBy.name": "REP_NAME",
  "filedBy.relation": "REP_REL",
  "filedBy.phone": "WHO",
};

const yesNo = (ctx: FlowCtx) => [
  { key: "1", label: t(ctx, "হ্যাঁ", "Yes") },
  { key: "2", label: t(ctx, "না", "No") },
];

export const NODES: Record<string, FlowNode> = {
  LANG: {
    id: "LANG",
    input: "choice",
    prompt: () => "DLAS আইনি সহায়তা / Legal aid. ভাষা বেছে নিন / Choose language",
    options: () => [
      { key: "1", label: "বাংলা" },
      { key: "2", label: "English" },
    ],
    handle: (v, ctx, s) => {
      if (v !== "1" && v !== "2") return { error: "1 / 2" };
      IntakeGateway.capture(s.sessionId, { applicant: { preferredLanguage: v === "1" ? "bn" : "en" } }, tagFor(ctx, s, "choice"));
      return { next: "MAIN" };
    },
  },
  MAIN: {
    id: "MAIN",
    input: "choice",
    prompt: (ctx) => t(ctx, "সেবা বাছাই করুন", "Choose a service"),
    options: (ctx) => [
      { key: "1", label: t(ctx, "আইনি সহায়তার আবেদন", "Apply for legal aid") },
      { key: "0", label: ctx.mode === "IVR" ? t(ctx, "একজন মানুষের সাথে কথা বলুন", "Talk to a person") : t(ctx, "কল-ব্যাক চাই", "Request a call-back") },
    ],
    handle: (v, ctx, s) => {
      if (v === "1") return { next: "WHO" };
      if (v === "0") {
        IntakeGateway.requestCallback(s.sessionId, ctx.mode === "IVR" ? "IVR caller pressed 0 for a person" : "USSD user requested call-back");
        return { next: "END_CALLBACK" };
      }
      return { error: t(ctx, "১ বা ০ চাপুন", "Press 1 or 0") };
    },
  },
  WHO: {
    id: "WHO",
    input: "choice",
    prompt: (ctx) => t(ctx, "আবেদন কার জন্য?", "Who is this application for?"),
    options: (ctx) => [
      { key: "1", label: t(ctx, "আমার নিজের জন্য", "For myself") },
      { key: "2", label: t(ctx, "অন্য কারো পক্ষে", "On behalf of someone else") },
    ],
    handle: (v, ctx, s) => {
      const phone = s.identity.phone;
      if (v === "1") {
        IntakeGateway.capture(s.sessionId, { filedBy: { kind: "SELF", name: null, phone: null, relation: null } }, tagFor(ctx, s, "choice"));
        IntakeGateway.capture(
          s.sessionId,
          { applicant: { phone, phoneOwnedByApplicant: true } },
          { source: "SYSTEM_DERIVED", method: "SYSTEM", by: "system", note: ctx.mode === "IVR" ? "caller line id" : "USSD MSISDN" },
        );
        return { next: "NAME" };
      }
      if (v === "2") {
        IntakeGateway.capture(
          s.sessionId,
          { filedBy: { kind: "REPRESENTATIVE", phone } },
          { source: "REPRESENTATIVE_REPORTED", method: ctx.mode === "IVR" ? "IVR_DTMF" : "USSD_MENU", by: `rep:${phone}` },
        );
        return { next: "REP_NAME" };
      }
      return { error: t(ctx, "১ বা ২ চাপুন", "Press 1 or 2") };
    },
  },
  REP_NAME: {
    id: "REP_NAME",
    input: "text",
    prompt: (ctx) => ctx.mode === "IVR" ? t(ctx, "বিপ শব্দের পর আপনার নিজের নাম বলুন", "After the beep, say YOUR own name") : t(ctx, "আপনার নিজের নাম লিখুন", "Type YOUR own name"),
    handle: (v, ctx, s) => {
      if (v.trim().length < 2) return { error: t(ctx, "নাম বোঝা যায়নি", "Name not understood") };
      IntakeGateway.capture(s.sessionId, { filedBy: { name: v.trim() } }, { ...tagFor(ctx, s, "text"), source: "REPRESENTATIVE_REPORTED" });
      return { next: "REP_REL" };
    },
  },
  REP_REL: {
    id: "REP_REL",
    input: "choice",
    prompt: (ctx) => t(ctx, "আবেদনকারী আপনার কে হন?", "How are you related to the applicant?"),
    options: (ctx) => menu(ctx, RELATIONS),
    handle: (v, ctx, s) => {
      const code = byIndex(RELATIONS, v);
      if (!code) return { error: t(ctx, "সঠিক নম্বর চাপুন", "Choose a listed number") };
      IntakeGateway.capture(s.sessionId, { filedBy: { relation: code } }, tagFor(ctx, s, "choice"));
      return { next: "APPLICANT_PHONE" };
    },
  },
  APPLICANT_PHONE: {
    id: "APPLICANT_PHONE",
    input: "digits",
    prompt: (ctx) => t(ctx, "আবেদনকারীর মোবাইল নম্বর দিন, শেষে #", "Enter the applicant's mobile number, then #"),
    handle: (v, ctx, s) => {
      const p = normalizePhone(v);
      if (!p) return { error: t(ctx, "১১ সংখ্যার নম্বর দিন (01…)", "Enter an 11-digit number (01…)") };
      IntakeGateway.capture(s.sessionId, { applicant: { phone: p, phoneOwnedByApplicant: null } }, tagFor(ctx, s, "digits"));
      return { next: "NAME" };
    },
  },
  NAME: {
    id: "NAME",
    input: "text",
    prompt: (ctx, s) =>
      ctx.mode === "IVR"
        ? isRep(s) ? t(ctx, "বিপের পর আবেদনকারীর পুরো নাম বলুন", "After the beep, say the applicant's full name") : t(ctx, "বিপের পর আপনার পুরো নাম বলুন", "After the beep, say your full name")
        : isRep(s) ? t(ctx, "আবেদনকারীর পুরো নাম লিখুন", "Type the applicant's full name") : t(ctx, "আপনার পুরো নাম লিখুন", "Type your full name"),
    handle: (v, ctx, s) => {
      if (v.trim().length < 2) return { error: t(ctx, "নাম বোঝা যায়নি", "Name not understood") };
      IntakeGateway.capture(s.sessionId, { applicant: { fullName: v.trim() } }, tagFor(ctx, s, "text"));
      return { next: "NAME_CONFIRM" };
    },
  },
  NAME_CONFIRM: {
    id: "NAME_CONFIRM",
    input: "choice",
    prompt: (ctx, s) => t(ctx, `নাম: "${s.draft.applicant.fullName}"। ঠিক আছে?`, `Name: "${s.draft.applicant.fullName}". Is that right?`),
    options: (ctx) => [
      { key: "1", label: t(ctx, "ঠিক আছে", "Correct") },
      { key: "2", label: t(ctx, "আবার বলব", "Say it again") },
    ],
    handle: (v, ctx, s) => {
      if (v === "2") return { next: "NAME" };
      if (v !== "1") return { error: "1 / 2" };
      confirmReadBack(ctx, s, "applicant.fullName", s.draft.applicant.fullName ?? "");
      return { next: "GENDER" };
    },
  },
  GENDER: {
    id: "GENDER",
    input: "choice",
    prompt: (ctx) => t(ctx, "লিঙ্গ", "Gender"),
    options: (ctx) => menu(ctx, GENDERS),
    handle: (v, ctx, s) => {
      const code = byIndex(GENDERS, v);
      if (!code) return { error: t(ctx, "১–৪ চাপুন", "Press 1–4") };
      IntakeGateway.capture(s.sessionId, { applicant: { gender: code } }, tagFor(ctx, s, "choice"));
      return { next: "DISTRICT" };
    },
  },
  DISTRICT: {
    id: "DISTRICT",
    input: "choice",
    prompt: (ctx) => t(ctx, "কোন জেলা?", "Which district?"),
    options: (ctx) => menu(ctx, DISTRICTS),
    handle: (v, ctx, s) => {
      const code = byIndex(DISTRICTS, v);
      if (!code) return { error: t(ctx, "১–৮ চাপুন", "Press 1–8") };
      IntakeGateway.capture(s.sessionId, { applicant: { district: code } }, tagFor(ctx, s, "choice"));
      return { next: "NID" };
    },
  },
  NID: {
    id: "NID",
    input: "digits",
    prompt: (ctx) =>
      t(ctx, "জাতীয় পরিচয়পত্র নম্বর দিন, শেষে #। না থাকলে শুধু # চাপুন", "Enter the NID number, then #. If there is none, just press #"),
    handle: (v, ctx, s) => {
      const d = v.replace(/\D/g, "");
      if (!d) return { next: "MATTER" }; // skipped — the DLAO verifies identity another way
      if (![10, 13, 17].includes(d.length)) return { error: t(ctx, "১০, ১৩ বা ১৭ সংখ্যা দিন, অথবা শুধু #", "Enter 10, 13 or 17 digits, or just #") };
      IntakeGateway.capture(s.sessionId, { applicant: { nidNumber: d } }, tagFor(ctx, s, "digits"));
      return { next: "MATTER" };
    },
  },
  MATTER: {
    id: "MATTER",
    input: "choice",
    prompt: (ctx) => t(ctx, "সমস্যার ধরন", "Type of problem"),
    options: (ctx) => menu(ctx, MATTERS),
    handle: (v, ctx, s) => {
      const code = byIndex(MATTERS, v);
      if (!code) return { error: t(ctx, "১–৮ চাপুন", "Press 1–8") };
      IntakeGateway.capture(s.sessionId, { matter: { category: code } }, tagFor(ctx, s, "choice"), { step: "DETAILS_CAPTURED" });
      return { next: "SUMMARY" };
    },
  },
  SUMMARY: {
    id: "SUMMARY",
    input: "text",
    prompt: (ctx) =>
      ctx.mode === "IVR"
        ? t(ctx, "বিপের পর সংক্ষেপে সমস্যাটি বলুন", "After the beep, briefly describe the problem")
        : t(ctx, "সংক্ষেপে সমস্যা লিখুন (১৬০ অক্ষর)", "Describe the problem briefly (160 chars)"),
    handle: (v, ctx, s) => {
      if (v.trim().length < 10) return { error: t(ctx, "আরেকটু বিস্তারিত বলুন (১০+ অক্ষর)", "Please say a bit more (10+ characters)") };
      IntakeGateway.capture(s.sessionId, { matter: { summary: v.trim().slice(0, ctx.mode === "USSD" ? 160 : 1000) } }, tagFor(ctx, s, "text"));
      return { next: "SUMMARY_CONFIRM" };
    },
  },
  SUMMARY_CONFIRM: {
    id: "SUMMARY_CONFIRM",
    input: "choice",
    prompt: (ctx, s) => t(ctx, `আপনি বলেছেন: "${s.draft.matter.summary}"। ঠিক আছে?`, `You said: "${s.draft.matter.summary}". Correct?`),
    options: (ctx) => [
      { key: "1", label: t(ctx, "ঠিক আছে", "Correct") },
      { key: "2", label: t(ctx, "আবার বলব", "Say it again") },
    ],
    handle: (v, ctx, s) => {
      if (v === "2") return { next: "SUMMARY" };
      if (v !== "1") return { error: "1 / 2" };
      confirmReadBack(ctx, s, "matter.summary", s.draft.matter.summary ?? "");
      return { next: "DANGER" };
    },
  },
  DANGER: {
    id: "DANGER",
    input: "choice",
    prompt: (ctx) => t(ctx, "আবেদনকারী কি এখন বিপদে আছেন?", "Is the applicant in danger right now?"),
    options: yesNo,
    handle: (v, ctx, s) => {
      if (v !== "1" && v !== "2") return { error: "1 / 2" };
      const danger = v === "1";
      IntakeGateway.capture(
        s.sessionId,
        { urgency: { selfReportedUrgent: danger, flags: danger ? ["IMMEDIATE_DANGER"] : [] } },
        tagFor(ctx, s, "choice"),
      );
      return { next: "SAFE_CALL" };
    },
  },
  SAFE_CALL: {
    id: "SAFE_CALL",
    input: "choice",
    prompt: (ctx, s) => t(ctx, `অফিস কি ${s.draft.applicant.phone ?? "এই নম্বরে"} নিরাপদে ফোন করতে পারবে?`, `Is it safe for the office to call ${s.draft.applicant.phone ?? "this number"}?`),
    options: (ctx, s) => [
      { key: "1", label: t(ctx, "হ্যাঁ, এই নম্বরে", "Yes, this number") },
      { key: "2", label: t(ctx, "না, অন্য নিরাপদ নম্বর দেব", "No, I'll give a safe number") },
      isRep(s)
        ? { key: "3", label: t(ctx, "প্রতিনিধির মাধ্যমে", "Through the representative") }
        : { key: "3", label: t(ctx, "অফিসে এসে জানব", "I'll visit the office") },
    ],
    handle: (v, ctx, s) => {
      const tag = tagFor(ctx, s, "choice");
      if (v === "1") {
        IntakeGateway.capture(s.sessionId, { safeContact: { method: "CALL", phone: s.draft.applicant.phone } }, tag);
        return { next: "SAFE_TIME" };
      }
      if (v === "2") return { next: "SAFE_NUMBER" };
      if (v === "3") {
        IntakeGateway.capture(
          s.sessionId,
          { safeContact: { method: isRep(s) ? "VIA_REPRESENTATIVE" : "VISIT_OFFICE", phone: isRep(s) ? s.draft.filedBy.phone : null } },
          tag,
        );
        return { next: "SAFE_TIME" };
      }
      return { error: "1 / 2 / 3" };
    },
  },
  SAFE_NUMBER: {
    id: "SAFE_NUMBER",
    input: "digits",
    prompt: (ctx) => t(ctx, "নিরাপদ নম্বরটি দিন, শেষে #", "Enter the safe number, then #"),
    handle: (v, ctx, s) => {
      const p = normalizePhone(v);
      if (!p) return { error: t(ctx, "১১ সংখ্যার নম্বর দিন", "Enter an 11-digit number") };
      IntakeGateway.capture(s.sessionId, { safeContact: { method: "CALL", phone: p } }, tagFor(ctx, s, "digits"));
      return { next: "SAFE_TIME" };
    },
  },
  SAFE_TIME: {
    id: "SAFE_TIME",
    input: "choice",
    prompt: (ctx) => t(ctx, "কখন যোগাযোগ করা নিরাপদ?", "When is it safe to contact?"),
    options: (ctx) => menu(ctx, SAFE_TIMES),
    handle: (v, ctx, s) => {
      const code = byIndex(SAFE_TIMES, v);
      if (!code) return { error: t(ctx, "১–৪ চাপুন", "Press 1–4") };
      IntakeGateway.capture(s.sessionId, { safeContact: { safeTime: code } }, tagFor(ctx, s, "choice"));
      return { next: "SMS_OK" };
    },
  },
  SMS_OK: {
    id: "SMS_OK",
    input: "choice",
    prompt: (ctx) => t(ctx, "এসএমএস পাঠানো যাবে? (বার্তায় 'আইনি সহায়তা' লেখা থাকবে না)", "May we send SMS? (Messages never say 'legal aid')"),
    options: yesNo,
    handle: (v, ctx, s) => {
      if (v !== "1" && v !== "2") return { error: "1 / 2" };
      IntakeGateway.capture(
        s.sessionId,
        { safeContact: { smsAllowed: v === "1", voicemailAllowed: false, neutralWordingRequired: true } },
        tagFor(ctx, s, "choice"),
      );
      return { next: "DOCS" };
    },
  },
  DOCS: {
    id: "DOCS",
    input: "choice",
    prompt: (ctx, s) => {
      const docs = s.draft.matter.category ? REQUIRED_DOCS[s.draft.matter.category] : [];
      const list = docs.map((d) => label(DOC_TYPES, d, ctx.lang)).join(", ");
      return t(ctx, `পরে ইউডিসি বা অফিসে এই কাগজ আনবেন: ${list}`, `Bring these documents later to a UDC or the office: ${list}`);
    },
    options: (ctx) => [{ key: "1", label: t(ctx, "বুঝেছি", "Understood") }],
    handle: (v, ctx, s) => {
      if (v !== "1") return { error: "1" };
      IntakeGateway.ensureChecklist(s.sessionId, { source: "SYSTEM_DERIVED", method: "SYSTEM", by: "system", note: "checklist for matter" });
      IntakeGateway.setStep(s.sessionId, "DOCUMENTS_ATTACHED");
      return { next: "CONSENT" };
    },
  },
  CONSENT: {
    id: "CONSENT",
    input: "choice",
    prompt: (ctx) =>
      t(
        ctx,
        "আপনার তথ্য শুধু এই আবেদন যাচাই ও সেবার জন্য দায়িত্বপ্রাপ্ত কর্মকর্তারা দেখবেন। সেবা সম্পূর্ণ বিনামূল্যে। আপনি কি সম্মত?",
        "Your information is used only to process this request and is seen only by the officers handling it. The service is free. Do you agree?",
      ),
    options: (ctx) => [
      { key: "1", label: t(ctx, "সম্মত", "I agree") },
      { key: "2", label: t(ctx, "সম্মত নই", "I do not agree") },
    ],
    handle: (v, ctx, s) => {
      if (v === "2") {
        IntakeGateway.abandon(s.sessionId);
        return { next: "END_NO_CONSENT" };
      }
      if (v !== "1") return { error: "1 / 2" };
      IntakeGateway.capture(
        s.sessionId,
        {
          consent: {
            dataProcessing: true,
            contactOnSafeChannel: true,
            shareWithAssignedProviders: true,
            method: ctx.mode === "IVR" ? "IVR_DTMF_1" : "USSD_OPTION_1",
            readBackConfirmed: true,
            recordedAt: new Date().toISOString(),
          },
          freeServiceNoticeAcknowledged: true,
        },
        tagFor(ctx, s, "choice"),
      );
      return { next: "REVIEW" };
    },
  },
  REVIEW: {
    id: "REVIEW",
    input: "choice",
    prompt: (ctx, s) => {
      const d = s.draft;
      return t(
        ctx,
        `${d.applicant.fullName}, ${label(DISTRICTS, d.applicant.district, "bn")}, ${label(MATTERS, d.matter.category, "bn")}, যোগাযোগ: ${label(CONTACT_METHODS, d.safeContact.method, "bn")}। জমা দেবেন?`,
        `${d.applicant.fullName}, ${label(DISTRICTS, d.applicant.district, "en")}, ${label(MATTERS, d.matter.category, "en")}, contact: ${label(CONTACT_METHODS, d.safeContact.method, "en")}. Submit?`,
      );
    },
    options: (ctx) => [
      { key: "1", label: t(ctx, "জমা দিন", "Submit") },
      { key: "2", label: t(ctx, "নাম থেকে আবার শুরু", "Restart from name") },
    ],
    handle: (v, ctx, s) => {
      if (v === "2") return { next: "NAME" };
      if (v !== "1") return { error: "1 / 2" };
      IntakeGateway.setStep(s.sessionId, "REVIEWED");
      const r = IntakeGateway.submit(s.sessionId, isRep(s) ? `rep:${s.identity.phone}` : "applicant");
      if (!r.ok) {
        const first = r.validation.missing[0];
        const node = (first && PATH_TO_NODE[first]) || "NAME";
        return { error: t(ctx, `তথ্য অসম্পূর্ণ: ${r.validation.missing.join(", ")}`, `Incomplete: ${r.validation.missing.join(", ")}`) + ` → ${node}` };
      }
      return { next: "DONE" };
    },
  },
  DONE: {
    id: "DONE",
    input: "choice",
    terminal: true,
    prompt: (ctx, s) => {
      const id = s.applicationId ?? "";
      const spoken = ctx.mode === "IVR" ? ` (${id.replace(/[^0-9]/g, "").split("").join(" ")})` : "";
      return t(ctx, `আবেদন জমা হয়েছে। আবেদন আইডি: ${id}${spoken}। অফিস নিরাপদ সময়ে যোগাযোগ করবে।`, `Application submitted. Application ID: ${id}${spoken}. The office will contact you at the safe time.`);
    },
    options: (ctx) => [{ key: "1", label: t(ctx, "আবার শুনুন", "Repeat") }],
    handle: () => ({ next: "DONE" }),
  },
  END_CALLBACK: {
    id: "END_CALLBACK",
    input: "choice",
    terminal: true,
    prompt: (ctx) => t(ctx, "একজন সহায়তা কর্মী আপনাকে ফোন করবেন। কল-ব্যাক কাজ তৈরি হয়েছে।", "A helpline agent will call you back. A call-back task has been created."),
    handle: () => ({ next: "END_CALLBACK" }),
  },
  END_NO_CONSENT: {
    id: "END_NO_CONSENT",
    input: "choice",
    terminal: true,
    prompt: (ctx) => t(ctx, "সম্মতি ছাড়া আবেদন জমা হবে না। আপনি ১৬৬৯৯-এ কল করে কথা বলতে পারেন।", "Without consent the application is not submitted. You can call 16699 to talk to a person."),
    handle: () => ({ next: "END_NO_CONSENT" }),
  },
};

export const START_NODE = "LANG";

/** Parse a "→ NODE" jump hint appended to REVIEW errors. */
export function jumpTarget(error: string): string | null {
  const m = error.match(/→ ([A-Z_]+)$/);
  return m ? m[1] : null;
}
