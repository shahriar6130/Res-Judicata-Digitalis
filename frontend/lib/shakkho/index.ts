/* ------------------------------------------------------------------ *
 *  Single entry point for the helpline workspace.
 *
 *  - Runs `seedDemoData()` lazily on first access.
 *  - Re-exports every service so panels only need one import.
 *  - Exposes `useHelplineStore()` for panels that want a re-render hook.
 * ------------------------------------------------------------------ */

import { read, write, useHelplineStore } from "./persistence";
import { seedDemoData, resetScenario } from "./seed";

import { ApplicationRecordService } from "./services/application-record.service";
import { RepresentationService } from "./services/representation.service";
import { SafeContactService } from "./services/safe-contact.service";
import { IntakeSessionService } from "./services/intake-session.service";
import { CallerVerificationService } from "./services/caller-verification.service";
import { CommunicationHistoryService } from "./services/communication-history.service";
import {
  HumanHandoffService,
  handoffRecordToDlao,
} from "./services/human-handoff.service";
import { AuditTrailService } from "./services/audit-trail.service";
import { ConversationalIntakeService } from "./services/conversational-intake.service";
import { HelplineService } from "./services/helpline.service";
import {
  UrgencyRulesService,
  maxUrgencyLevel,
} from "./services/urgency-rules.service";
import { RiponScript } from "./assistants/ripon.script";
import { HumanIntakeService } from "./services/human-intake.service";
import { SafeContactPlanService } from "./services/safe-contact-plan.service";
import { DlaoVerificationService } from "./services/dlao-verification.service";
import { ActiveCallBarService } from "./services/active-call-bar.service";

/* Phase 5 services. */
import { OfflineStore, useOfflineStore, offlineCapabilities } from "./services/offline-store.service";
import { IntegrityVerificationService, integrityThreatModel } from "./services/integrity-verification.service";
import {
  SyncQueueService,
  SimulatedDlasServer,
  syncCapabilities,
} from "./services/sync-queue.service";
import { ConflictResolutionService } from "./services/conflict-resolution.service";
import { NetworkConditionService } from "./services/network-condition.service";
import { PwaCapabilityService } from "./services/pwa-capability.service";
import { CachePolicyService } from "./services/cache-policy.service";
import { PerformanceMeasurementService } from "./services/performance-measurement.service";
import { ConsentService } from "./services/consent.service";
import { TranslationProvenanceService } from "./services/translation-provenance.service";
import { DocumentCaptureService } from "./services/document-capture.service";
import { DocumentQualityService } from "./services/document-quality.service";
import { UdcAuthorizationService } from "./services/udc-authorization.service";
import { AssistedIntakeService } from "./services/assisted-intake.service";

export * from "./types";
export { useHelplineStore, read, write, resetScenario };
export {
  ApplicationRecordService,
  RepresentationService,
  SafeContactService,
  IntakeSessionService,
  CallerVerificationService,
  CommunicationHistoryService,
  HumanHandoffService,
  AuditTrailService,
  ConversationalIntakeService,
  HelplineService,
  UrgencyRulesService,
  maxUrgencyLevel,
  RiponScript,
  HumanIntakeService,
  SafeContactPlanService,
  DlaoVerificationService,
  ActiveCallBarService,
  handoffRecordToDlao,

  /* Phase 5 */
  OfflineStore,
  useOfflineStore,
  offlineCapabilities,
  IntegrityVerificationService,
  integrityThreatModel,
  SyncQueueService,
  SimulatedDlasServer,
  syncCapabilities,
  ConflictResolutionService,
  NetworkConditionService,
  PwaCapabilityService,
  CachePolicyService,
  PerformanceMeasurementService,
  ConsentService,
  TranslationProvenanceService,
  DocumentCaptureService,
  DocumentQualityService,
  UdcAuthorizationService,
  AssistedIntakeService,
};

/* Ensures the seed runs once per browser. Call from the workspace
   component on mount; subsequent calls are no-ops. */
export function ensureSeeded(): void {
  const envelope = read();
  if (envelope.seededAt) return;
  write(seedDemoData(envelope));
}
