import { mutate } from "./store";
import { DISTRICTS, MATTERS, normalizePhone } from "./reference";
import type { AuditEntry, DistrictCode, DlasDb, MatterCategory, MediationCaseType, MediationTrack, MediatorRecord, MediatorRole, MediatorStatus, OfficeType } from "./schema";

export type ManagedRole = "citizens" | "lawyers" | "officers" | "mediators" | "udcOperators";
export type ManagedInput = {
  name: string;
  phone: string;
  district?: string;
  officeType?: string;
  centre?: string;
  barEnrolmentNo?: string;
  practiceAreas?: string[];
  mediatorStatus?: string;
  mediatorRole?: string;
  qualification?: string;
  caseTypes?: string[];
  tracks?: string[];
};

const idField = { citizens: "citizenId", lawyers: "lawyerId", officers: "officerId", mediators: "mediatorId", udcOperators: "operatorId" } as const;
const prefix = { citizens: "CIT", lawyers: "LAW", officers: "OFC", mediators: "MED", udcOperators: "UDC" } as const;
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
    if (role === "mediators" && !input.qualification?.trim()) throw new Error("Enter the mediator's qualification.");
    if (role === "mediators" && !(input.caseTypes?.length)) throw new Error("Select at least one mediation case type.");
    if (role === "mediators" && !(input.tracks?.length)) throw new Error("Select at least one mediation track.");
    return mutate((db) => {
      if (role === "mediators") {
        const existing = accountId ? db.mediators.find((x) => x.mediatorId === accountId) : undefined;
        if (accountId && !existing) throw new Error("Mediator no longer exists.");
        if (db.mediators.some((x) => x.contact.phone === phone && x !== existing)) throw new Error("This phone is already used by a mediator.");
        const at = new Date().toISOString();
        const values = {
          name,
          role: (input.mediatorRole ?? "PANEL_MEDIATOR") as MediatorRole,
          status: (input.mediatorStatus ?? "PENDING_VERIFICATION") as MediatorStatus,
          district: district as DistrictCode,
          qualification: { kind: "OTHER" as const, detail: input.qualification!.trim() },
          caseTypes: (input.caseTypes ?? []) as MediationCaseType[],
          tracks: (input.tracks ?? []) as MediationTrack[],
          contact: { ...(existing?.contact ?? { email: null, preferredChannel: "PHONE" as const, office: null }), phone },
          updatedAt: at,
        };
        const mediator: MediatorRecord = existing ?? {
          mediatorId: id("MED"),
          name,
          role: values.role,
          status: values.status,
          statusReason: "Created by DBLA / Admin",
          statusChangedAt: at,
          qualification: values.qualification,
          certification: { status: "NOT_TRAINED", body: null, certificateNo: null, issuedOn: null, validUntil: null, verifiedBy: null, verifiedByName: null, verifiedAt: null },
          experience: { years: 0, mediationsConducted: 0, settled: 0, note: null },
          caseTypes: values.caseTypes,
          tracks: values.tracks,
          district: values.district,
          operationalAreas: [],
          languages: ["bn"],
          availability: { status: "AVAILABLE", days: ["SUN", "MON", "TUE", "WED", "THU"], channels: ["PHYSICAL", "VOICE"], maxActiveMatters: 10, unavailableUntil: null, note: null, updatedAt: at },
          workload: { activeMatters: 0, basis: "RECORDED", updatedAt: at },
          conflicts: [],
          adminRecord: [],
          contact: values.contact,
          sample: false,
          createdAt: at,
          createdBy: "admin:prototype",
          updatedAt: at,
          audit: [],
        };
        const previousStatus = mediator.status;
        Object.assign(mediator, values);
        if (previousStatus !== mediator.status) {
          mediator.statusChangedAt = at;
          mediator.statusReason = "Updated by DBLA / Admin";
        }
        if (!existing) db.mediators.push(mediator);
        log(db, existing ? "mediator.account_updated" : "mediator.account_created", { role, accountId: mediator.mediatorId, fields: Object.keys(values) }, mediator.audit);
        return mediator.mediatorId;
      }
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

  deleteAccount(role: ManagedRole, accountId: string) {
    return mutate((db) => {
      if (role === "mediators") {
        const index = db.mediators.findIndex((x) => x.mediatorId === accountId);
        if (index < 0) throw new Error("Mediator no longer exists.");
        const active = db.applications.some((a) => a.mediation?.assignments.some((x) => x.mediatorId === accountId && !["DECLINED", "EXPIRED", "WITHDRAWN", "COMPLETED"].includes(x.status) && !x.accessRevokedAt));
        if (active) throw new Error("Remove or complete this mediator's active assignments before deleting the account.");
        const [account] = db.mediators.splice(index, 1);
        log(db, "mediator.account_deleted", { role, accountId, name: account.name, historicalRecordsPreserved: true });
        return;
      }
      if (role === "lawyers") {
        const active = db.applications.some((a) => a.lawyer?.assignments.some((x) => x.lawyerId === accountId && (x.status === "OFFERED" || x.status === "ACCEPTED")));
        if (active) throw new Error("Withdraw or complete this lawyer's active assignments before deleting the account.");
      }
      const list = db[role] as unknown as Array<{ name: string; [key: string]: unknown }>;
      const key = idField[role];
      const index = list.findIndex((x) => x[key] === accountId);
      if (index < 0) throw new Error("Account no longer exists.");
      const [account] = list.splice(index, 1);
      if (role === "udcOperators") db.udcCentres = db.udcCentres.filter((x) => x.operatorId !== accountId || x.source !== "REGISTERED_OPERATOR");
      log(db, "account.deleted", { role, accountId, name: account.name, historicalRecordsPreserved: true, linkedRegisteredCentreRemoved: role === "udcOperators" });
    });
  },
};
