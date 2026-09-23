/* DLAS shared-record core — import everything from "@/lib/dlas". */
export * from "./schema";
export * from "./reference";
export { IntakeGateway, type CaptureTag, type SubmitResult } from "./gateway";
export { validateApplication } from "./validate";
export { CitizenAuth, type AuthResult } from "./citizen-auth";
export { CitizenDoor, UdcDoor, type CitizenDraftLike, type UdcStartInput } from "./door-bridges";
export { useDlasDb, readDb, resetDb, exportDb, importDb, DLAS_KEY, StorageWriteError } from "./store";
export { UdcAuth, useCurrentUdcOperator, type UdcAuthResult } from "./udc-auth";
export { nidFormatValid, pathwayLabel, recommendPathway } from "./dlao";
export { DlaoAuth, DlaoReviewService, useCurrentOfficer, useOfficeQueue, useEligibilityRuleset, recommend, factChecklist, officeCode, subStage, bucketOf, type DlaoAuthResult, type QueueBucket } from "./dlao";
export { FileStore, useStoredFile, FILES_KEY } from "./files";
export { LawyerAuth, LawyerService, DlaoLawyerService, useCurrentLawyer, useLawyerWork, useLawyerDeadlineSweep, useLawyerRules, useClock, sweepLawyerDeadlines, activeAssignment, hasCaseAccess, suggestLawyers, hearingState, hearingMissed, computeLedger, rulesOf, lawyerDistrictLabel, DEFAULT_LAWYER_RULES, type LawyerAuthResult, type LawyerCase, type HearingState, type LawyerSuggestion } from "./lawyer";
