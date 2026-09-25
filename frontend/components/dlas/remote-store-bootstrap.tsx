"use client";

import { useEffect } from "react";
import { flushRemoteDb, hydrateRemoteDb } from "@/lib/dlas/store";

/** Starts the local-cache ↔ Upstash bridge once for the whole application. */
export function RemoteStoreBootstrap() {
  useEffect(() => {
    void hydrateRemoteDb();
    const retry = () => void hydrateRemoteDb().then(() => flushRemoteDb());
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);
  return null;
}
