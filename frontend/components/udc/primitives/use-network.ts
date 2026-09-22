"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  NetworkConditionService,
  type NetworkProfile,
  type NetworkProfileKind,
} from "@/lib/shakkho";

/**
 * Subscribes to NetworkConditionService and re-renders on every change.
 * Use this everywhere a row should react to live network conditions.
 */
export function useNetwork(): NetworkProfile {
  const [profile, setProfile] = useState<NetworkProfile>(NetworkConditionService.current());
  useEffect(() => {
    return NetworkConditionService.subscribe(setProfile);
  }, []);
  return profile;
}

/**
 * Convenience: returns the network kind only.
 */
export function useNetworkKind(): NetworkProfileKind {
  return useNetwork().kind;
}

/**
 * Returns a className segment describing current network state for row tinting.
 * Maps: normal | slow | intermittent | offline | reconnected | synchronizing
 */
export function networkRowClass(kind: NetworkProfileKind): string {
  switch (kind) {
    case "offline":       return "queueRowNetOffline";
    case "slow":          return "queueRowNetSlow";
    case "intermittent":  return "queueRowNetIntermittent";
    case "reconnected":   return "queueRowNetReconnected";
    default:              return "queueRowNetNormal";
  }
}

/** useSyncExternalStore bridge — for components that prefer it over useState. */
export function useNetworkSnapshot(): NetworkProfile {
  return useSyncExternalStore(
    (cb) => {
      const unsub = NetworkConditionService.subscribe(() => cb());
      return unsub;
    },
    () => NetworkConditionService.current(),
    () => NetworkConditionService.current(),
  );
}
