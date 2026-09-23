"use client";

/* ------------------------------------------------------------------ *
 *  Officer-viewable copies of uploaded documents.
 *
 *    localStorage["dlas.files.v1"] = { [docId]: { mime, dataUrl, bytes, storedAt } }
 *
 *  Kept OUT of dlas.db.v1 so the case record stays small. Images are
 *  downscaled (max 1200px, JPEG) so a copy fits the browser quota; PDFs
 *  up to ~450 KB are kept as-is. Anything larger keeps only metadata +
 *  SHA-256 on the record (DocumentRef.preview = "TOO_LARGE").
 * ------------------------------------------------------------------ */

import { useSyncExternalStore } from "react";

export const FILES_KEY = "dlas.files.v1";
const EVENT = "dlas:files-changed";
const MAX_PDF = 450 * 1024;
const MAX_DIM = 1200;

type Stored = { mime: string; dataUrl: string; bytes: number; storedAt: string };

function readAll(): Record<string, Stored> {
  try {
    return JSON.parse(window.localStorage.getItem(FILES_KEY) ?? "{}") as Record<string, Stored>;
  } catch {
    return {};
  }
}

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function downscale(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("image decode failed"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

export const FileStore = {
  /** Save a viewable copy. Returns what the record should say about the preview. */
  async put(docId: string, source: Blob | string, mime: string): Promise<"STORED" | "TOO_LARGE" | "NONE"> {
    try {
      let dataUrl = typeof source === "string" ? source : await toDataUrl(source);
      if (mime.startsWith("image/")) dataUrl = await downscale(dataUrl);
      else if (mime === "application/pdf") {
        if (dataUrl.length * 0.75 > MAX_PDF) return "TOO_LARGE";
      } else return "NONE";
      const all = readAll();
      all[docId] = { mime: mime.startsWith("image/") ? "image/jpeg" : mime, dataUrl, bytes: Math.round(dataUrl.length * 0.75), storedAt: new Date().toISOString() };
      window.localStorage.setItem(FILES_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent(EVENT));
      return "STORED";
    } catch {
      return "TOO_LARGE"; // quota full or decode failure — visible on the record, never silent
    }
  },

  get(docId: string): Stored | undefined {
    return readAll()[docId];
  },
};

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The stored copy for one document (re-renders when files change). */
export function useStoredFile(docId: string): Stored | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(FILES_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as Record<string, Stored>)[docId];
  } catch {
    return undefined;
  }
}
