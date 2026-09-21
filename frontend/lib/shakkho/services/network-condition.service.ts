/* ------------------------------------------------------------------ *
 *  NetworkConditionService — explicit, deterministic profiles.
 *
 *  Drives the UDC network-status banner. Colour is NEVER the only
 *  signal — text + icon accompany every state.
 * ------------------------------------------------------------------ */

import { publish } from "../event-bus";
import type { NetworkProfile, NetworkProfileKind } from "../types";

export const NETWORK_EVENT = "shakkho:network";

const listeners = new Set<(p: NetworkProfile) => void>();

function defaultProfile(): NetworkProfile {
  return {
    kind: "normal",
    latencyMs: 80,
    packetLoss: 0,
    bandwidthBps: 1_200_000,
    statusLabel: { bn: "সাধারণ নেটওয়ার্ক", en: "Normal network" },
    setAt: new Date().toISOString(),
  };
}

let profile: NetworkProfile = defaultProfile();

function statusLabelFor(kind: NetworkProfileKind): { bn: string; en: string } {
  switch (kind) {
    case "normal":
      return { bn: "সাধারণ নেটওয়ার্ক", en: "Normal network" };
    case "slow":
      return { bn: "ধীর নেটওয়ার্ক", en: "Slow network" };
    case "intermittent":
      return { bn: "বিচ্ছিন্ন নেটওয়ার্ক", en: "Intermittent network" };
    case "offline":
      return { bn: "অফলাইন", en: "Offline" };
    case "reconnected":
      return { bn: "পুনঃসংযুক্ত", en: "Reconnected" };
  }
}

function profileFor(kind: NetworkProfileKind): NetworkProfile {
  const base: NetworkProfile = { ...defaultProfile(), kind, statusLabel: statusLabelFor(kind), setAt: new Date().toISOString() };
  switch (kind) {
    case "normal":
      base.latencyMs = 80;
      base.packetLoss = 0;
      base.bandwidthBps = 1_200_000;
      break;
    case "slow":
      base.latencyMs = 1800;
      base.packetLoss = 0.02;
      base.bandwidthBps = 64_000;
      break;
    case "intermittent":
      base.latencyMs = 2400;
      base.packetLoss = 0.25;
      base.bandwidthBps = 32_000;
      break;
    case "offline":
      base.latencyMs = 0;
      base.packetLoss = 1;
      base.bandwidthBps = 0;
      break;
    case "reconnected":
      base.latencyMs = 220;
      base.packetLoss = 0.01;
      base.bandwidthBps = 800_000;
      break;
  }
  return base;
}

function emit(): void {
  publish(NETWORK_EVENT, profile);
  listeners.forEach((cb) => cb(profile));
}

export const NetworkConditionService = {
  current(): NetworkProfile {
    return profile;
  },

  setProfile(kind: NetworkProfileKind): NetworkProfile {
    profile = profileFor(kind);
    emit();
    return profile;
  },

  /** Convenience helper — used by the network banner dropdown. */
  cycle(): NetworkProfile {
    const order: NetworkProfileKind[] = ["normal", "slow", "intermittent", "offline", "reconnected"];
    const idx = order.indexOf(profile.kind);
    return NetworkConditionService.setProfile(order[(idx + 1) % order.length]);
  },

  subscribe(cb: (p: NetworkProfile) => void): () => void {
    listeners.add(cb);
    // Send the current snapshot so subscribers can render immediately.
    cb(profile);
    return () => {
      listeners.delete(cb);
    };
  },
};
