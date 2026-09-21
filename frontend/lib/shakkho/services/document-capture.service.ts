/* ------------------------------------------------------------------ *
 *  DocumentCaptureService — captures + quality-checks documents.
 *
 *  - Stores compressed metadata only; no actual binary upload.
 *  - `qualityFindings` is the array produced by DocumentQualityService.
 *  - `retake` increments `version` and clears prior findings so audit
 *    can follow the trail.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import { makeId } from "./_internal/async-helpers";
import type {
  DocumentCapture,
  DocumentQualityFinding,
} from "../types";

export const DOCUMENT_EVENT = "shakkho:document";

const listeners = new Set<(d: DocumentCapture) => void>();
function emit(d: DocumentCapture): void {
  publish(DOCUMENT_EVENT, d);
  listeners.forEach((cb) => cb(d));
}

export const DocumentCaptureService = {
  capture(input: {
    applicationOrDraftId: string;
    checklistItemId: string;
    capturedBy: string;
    documentType: { bn: string; en: string };
    pageCount: number;
    bytes: number;
    compressed: boolean;
    pageOrder: number[];
    sensitivity: "public" | "restricted";
  }): DocumentCapture {
    const capture: DocumentCapture = {
      id: makeId("DOC"),
      applicationOrDraftId: input.applicationOrDraftId,
      checklistItemId: input.checklistItemId,
      capturedBy: input.capturedBy,
      capturedAt: new Date().toISOString(),
      pageCount: input.pageCount,
      bytes: input.bytes,
      compressed: input.compressed,
      pageOrder: input.pageOrder,
      qualityFindings: [],
      sensitivity: input.sensitivity,
      documentType: input.documentType,
      version: 1,
      applicantConfirmed: false,
    };
    emit(capture);
    return capture;
  },

  attachQuality(capture: DocumentCapture, findings: DocumentQualityFinding[]): DocumentCapture {
    const updated: DocumentCapture = { ...capture, qualityFindings: findings };
    emit(updated);
    return updated;
  },

  confirmByApplicant(capture: DocumentCapture): DocumentCapture {
    const updated: DocumentCapture = { ...capture, applicantConfirmed: true };
    emit(updated);
    return updated;
  },

  retake(capture: DocumentCapture): DocumentCapture {
    const updated: DocumentCapture = {
      ...capture,
      id: makeId("DOC"),
      version: capture.version + 1,
      qualityFindings: [],
      applicantConfirmed: false,
      capturedAt: new Date().toISOString(),
    };
    emit(updated);
    return updated;
  },

  subscribe(cb: (d: DocumentCapture) => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
