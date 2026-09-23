/* DLAS shared-record core — import everything from "@/lib/dlas". */
export * from "./schema";
export * from "./reference";
export { IntakeGateway, type CaptureTag, type SubmitResult } from "./gateway";
export { validateApplication } from "./validate";
export { CitizenAuth, type AuthResult } from "./citizen-auth";
export { CitizenDoor, UdcDoor, type CitizenDraftLike, type UdcStartInput } from "./door-bridges";
export { useDlasDb, readDb, resetDb, exportDb, importDb, DLAS_KEY, StorageWriteError } from "./store";
export { UdcAuth, useCurrentUdcOperator, type UdcAuthResult } from "./udc-auth";
