import { mutate } from "./store";
import { DISTRICTS, MATTERS, normalizePhone } from "./reference";
import type { AuditEntry, DistrictCode, DlasDb, MatterCategory, OfficeType } from "./schema";

export type ManagedRole = "citizens" | "lawyers" | "officers" | "udcOperators";
export type ManagedInput = {
  name: string;
  phone: string;
  district?: string;
  officeType?: string;
  centre?: string;
  barEnrolmentNo?: string;
  practiceAreas?: string[];
};

const idField = { citizens: "citizenId", lawyers: "lawyerId", officers: "officerId", udcOperators: "operatorId" } as const;
const prefix = { citizens: "CIT", lawyers: "LAW", officers: "OFC", udcOperators: "UDC" } as const;
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0")}`;

function log(db: DlasDb, action: string, detail: Record<string, unknown>, accountAudit?: AuditEntry[]) {
  const entry: AuditEntry = { seq: ++db.counters.auditSeq, at: new Date().toISOString(), actor: "admin:prototype", role: "admin", action, detail };
  db.adminAudit.push(entry);
  accountAudit?.push(entry);
}

export const AdminService = {
  saveAccount(role: ManagedRole, accountId: string | null, input: ManagedInput) {
    const name = input.name.trim();
    const phone = normalizePhone(input.phone);
    if (name.length < 2) throw new Error("Enter a name with at least two characters.");
    if (!phone) throw new Error("Enter a valid 11-digit Bangladesh mobile number.");
    const district = DISTRICTS.find((x) => x.code === input.district)?.code;
    if (role !== "citizens" && !(role === "officers" && input.officeType === "SCLAC") && !district) throw new Error("Select a district.");
    if (role === "officers" && !["DLAO", "SCLAC", "LLAC"].includes(input.officeType ?? "")) throw new Error("Select an office type.");
    if (role === "udcOperators" && !input.centre?.trim()) throw new Error("Enter a UDC centre.");
    if (role === "lawyers" && !input.barEnrolmentNo?.trim()) throw new Error("Enter the bar enrolment number.");
    return mutate((db) => {
      const list = db[role] as unknown as Array<{ name: string; phone: string; audit: AuditEntry[]; [key: string]: unknown }>;
      const key = idField[role];
      const existing = accountId ? list.find((x) => x[key] === accountId) : undefined;
      if (accountId && !existing) throw new Error("Account no longer exists.");
      if (list.some((x) => x.phone === phone && x !== existing)) throw new Error("This phone is already used for this role.");
      const values = {
        name, phone,
        ...(role === "officers" ? { officeType: input.officeType as OfficeType, district: input.officeType === "SCLAC" ? null : district as DistrictCode } : {}),
        ...(role === "lawyers" ? { district: district as DistrictCode, barEnrolmentNo: input.barEnrolmentNo!.trim(), practiceAreas: (input.practiceAreas ?? []).filter((x): x is MatterCategory => MATTERS.some((m) => m.code === x)) } : {}),
        ...(role === "udcOperators" ? { district: district as DistrictCode, centre: input.centre!.trim() } : {}),
      };
      const account: { name: string; phone: string; audit: AuditEntry[]; [key: string]: unknown } = existing ?? {
        [key]: id(prefix[role]), name, phone, createdAt: new Date().toISOString(), lastLoginAt: null, audit: [],
        ...(role === "citizens" ? { notificationsReadAt: null } : {}),
      };
      Object.assign(account, values);
      if (!existing) list.push(account as typeof list[number]);
      if (role === "udcOperators") {
        const operatorId = String(account.operatorId);
        const centre = db.udcCentres.find((x) => x.operatorId === operatorId);
        if (centre) {
          centre.name = { bn: input.centre!.trim(), en: input.centre!.trim() };
          centre.area = { bn: input.centre!.trim(), en: input.centre!.trim() };
          centre.district = district as DistrictCode;
        } else {
          db.udcCentres.push({
            centreId: `UDCC-${operatorId}`,
            name: { bn: input.centre!.trim(), en: input.centre!.trim() },
            area: { bn: input.centre!.trim(), en: input.centre!.trim() },
            district: district as DistrictCode,
            hours: { bn: "কেন্দ্রের সময় অনুযায়ী", en: "As per centre hours" },
            services: ["ASSISTED_APPLICATION", "DOCUMENT_SCAN", "STATUS_CHECK"],
            source: "REGISTERED_OPERATOR", operatorId, createdAt: new Date().toISOString(),
          });
        }
      }
      log(db, existing ? "account.updated" : "account.created", { role, accountId: account[key], fields: Object.keys(values) }, account.audit);
      return account[key] as string;
    });
  },
};
