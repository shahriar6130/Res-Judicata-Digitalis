/* ------------------------------------------------------------------ *
 *  DocumentQualityService — produces the findings attached to a capture.
 *
 *  Per Phase 5 §12: 10 issue codes, each with bilingual message and
 *  guidance. The `severity` decides whether the upload is blocked.
 * ------------------------------------------------------------------ */

import type { DocumentCapture, DocumentQualityFinding, DocumentQualityIssueCode } from "../types";

const FINDINGS: Record<DocumentQualityIssueCode, DocumentQualityFinding> = {
  blur: {
    code: "blur",
    message: { bn: "ছবি ঝাপসা", en: "Image is blurry" },
    guidance: { bn: "স্থির হয়ে আবার ছবি তুলুন", en: "Hold still and retake" },
    severity: "warn",
  },
  glare: {
    code: "glare",
    message: { bn: "অতিরিক্ত আলো প্রতিফলন", en: "Glare on document" },
    guidance: { bn: "অন্য কোণ থেকে ছবি তুলুন", en: "Try a different angle" },
    severity: "warn",
  },
  cropped_edges: {
    code: "cropped_edges",
    message: { bn: "প্রান্ত কাটা", en: "Edges cropped" },
    guidance: { bn: "পুরো কাগজটি ফ্রেমে আনুন", en: "Fit the whole page in the frame" },
    severity: "block",
  },
  low_contrast: {
    code: "low_contrast",
    message: { bn: "কম কনট্রাস্ট", en: "Low contrast" },
    guidance: { bn: "আরো আলোতে পুনরায় তুলুন", en: "Retake in better lighting" },
    severity: "warn",
  },
  missing_page: {
    code: "missing_page",
    message: { bn: "পৃষ্ঠা অনুপস্থিত", en: "Missing page" },
    guidance: { bn: "বহু-পৃষ্ঠা নথির প্রতিটি পৃষ্ঠা যোগ করুন", en: "Capture every page of multi-page docs" },
    severity: "block",
  },
  unreadable_text: {
    code: "unreadable_text",
    message: { bn: "টেক্সট পড়া যাচ্ছে না", en: "Text unreadable" },
    guidance: { bn: "ফোকাস পরীক্ষা করে পুনরায় তুলুন", en: "Check focus and retake" },
    severity: "block",
  },
  wrong_document_category: {
    code: "wrong_document_category",
    message: { bn: "ভুল ক্যাটাগরি", en: "Wrong document category" },
    guidance: { bn: "সঠিক ক্যাটাগরি নির্বাচন করুন", en: "Pick the right document type" },
    severity: "block",
  },
  duplicate_photograph: {
    code: "duplicate_photograph",
    message: { bn: "একই ছবি পুনরায়", en: "Duplicate of an earlier capture" },
    guidance: { bn: "একটি রাখুন — বাকিটি মুছুন", en: "Keep one, delete the other" },
    severity: "warn",
  },
  oversized_image: {
    code: "oversized_image",
    message: { bn: "আকার অনেক বড়", en: "Image too large" },
    guidance: { bn: "কম্প্রেস করে আবার চেষ্টা করুন", en: "Compress and retry" },
    severity: "warn",
  },
  uncertain_orientation: {
    code: "uncertain_orientation",
    message: { bn: "অনিশ্চিত ওরিয়েন্টেশন", en: "Uncertain orientation" },
    guidance: { bn: "নিশ্চিত করুন পৃষ্ঠা ঠিকমতো আছে", en: "Confirm the page is upright" },
    severity: "warn",
  },
};

export const DocumentQualityService = {
  codes(): DocumentQualityIssueCode[] {
    return Object.keys(FINDINGS) as DocumentQualityIssueCode[];
  },

  finding(code: DocumentQualityIssueCode): DocumentQualityFinding {
    return { ...FINDINGS[code] };
  },

  evaluate(capture: DocumentCapture, synthetic?: Partial<Record<DocumentQualityIssueCode, boolean>>): DocumentQualityFinding[] {
    const out: DocumentQualityFinding[] = [];
    const present = synthetic ?? DocumentQualityService.syntheticIssuesFor(capture);
    for (const code of Object.keys(present) as DocumentQualityIssueCode[]) {
      if (present[code]) out.push(DocumentQualityService.finding(code));
    }
    return out;
  },

  /**
   * Deterministic pseudo-quality result based on capture metadata —
   * used by the demo path so reviewers see findings without having to
   * upload a file. Real uploads would replace this with a vision model.
   */
  syntheticIssuesFor(capture: DocumentCapture): Partial<Record<DocumentQualityIssueCode, boolean>> {
    const out: Partial<Record<DocumentQualityIssueCode, boolean>> = {};
    if (capture.bytes < 32_000) out.blur = true;
    if (capture.bytes > 4_000_000) out.oversized_image = true;
    if (capture.pageCount > 1 && capture.pageOrder.length !== capture.pageCount) {
      out.missing_page = true;
    }
    return out;
  },

  hasBlocker(findings: DocumentQualityFinding[]): boolean {
    return findings.some((f) => f.severity === "block");
  },
};
