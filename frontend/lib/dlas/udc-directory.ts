/* ------------------------------------------------------------------ *
 *  Demo UDC centre directory — two centres per district, written into
 *  dlas.db.v1.udcCentres the first time the store is read.
 *
 *  These are DEMO entries (source: "DEMO_DIRECTORY", no phone numbers,
 *  no people's names) so a citizen can see "UDC centres in my district"
 *  before any operator has signed up. Every UDC operator who signs up
 *  is added to the same list with source "REGISTERED_OPERATOR".
 * ------------------------------------------------------------------ */

import { DISTRICTS } from "./reference";
import type { UdcCentre } from "./schema";

const HOURS = { bn: "রবি–বৃহস্পতি, সকাল ৯টা – বিকাল ৫টা", en: "Sun–Thu, 9:00–17:00" };
const SERVICES = ["ASSISTED_APPLICATION", "DOCUMENT_SCAN", "STATUS_CHECK", "VIDEO_CONSENT"];

export function demoUdcDirectory(createdAt: string): UdcCentre[] {
  const out: UdcCentre[] = [];
  for (const d of DISTRICTS) {
    out.push(
      {
        centreId: `UDCC-${d.code}-SADAR`,
        name: { bn: `${d.label.bn} সদর উপজেলা ডিজিটাল সেন্টার`, en: `${d.label.en} Sadar Upazila Digital Centre` },
        area: { bn: `${d.label.bn} সদর`, en: `${d.label.en} Sadar` },
        district: d.code,
        hours: HOURS,
        services: SERVICES,
        source: "DEMO_DIRECTORY",
        operatorId: null,
        createdAt,
      },
      {
        centreId: `UDCC-${d.code}-POURA`,
        name: { bn: `${d.label.bn} পৌরসভা ডিজিটাল সেন্টার`, en: `${d.label.en} Pourashava Digital Centre` },
        area: { bn: `${d.label.bn} পৌরসভা`, en: `${d.label.en} Pourashava` },
        district: d.code,
        hours: HOURS,
        services: SERVICES.slice(0, 3),
        source: "DEMO_DIRECTORY",
        operatorId: null,
        createdAt,
      },
    );
  }
  return out;
}
