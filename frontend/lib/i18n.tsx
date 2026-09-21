"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Lang = "bn" | "en";

export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: "bn", label: "বাংলা" },
  { id: "en", label: "English" },
];

const STORAGE_KEY = "shakkho.lang";

export type MessageKey =
  | "tagline"
  | "signInTitle"
  | "mobileNumber"
  | "mobilePlaceholder"
  | "passwordLabel"
  | "errorIdentifier"
  | "errorPassword"
  | "signingIn"
  | "signInAction"
  | "footer"
  | "workspacePlaceholder"
  | "backToSignIn"
  | "portalLinks"
  | "openMenu"
  | "closeMenu"
  | "simulated"
  | "simClock"
  | "simSms"
  | "simCourt"
  | "simScenario"
  | "simReset"
  | "navMyCases"
  | "navExpandCases"
  | "navCollapseCases"
  | "sidebarCaseItemLabel"
  | "sidebarCasePartySeparator"
  | "sidebarNoCases"
  | "sidebarCasesGroupLabel"
  | "navMessages"
  | "navProfile"
  | "navActionQueue"
  | "navCases"
  | "navAlerts"
  | "navAssignments"
  | "navTimeline"
  | "navAssignedCases"
  | "navHearingReports"
  | "navCalendar"
  | "navOverview"
  | "navUsers"
  | "navRules"
  | "navMetrics"
  | "navAudit"
  | "navFileComplaint"
  | "complaintTitle"
  | "complaintIntro"
  | "complaintReasonLabel"
  | "complaintReasonNotResponding"
  | "complaintReasonAskedPayment"
  | "complaintReasonOther"
  | "complaintOtherPlaceholder"
  | "complaintMessageLabel"
  | "complaintMessagePlaceholder"
  | "complaintSubmit"
  | "complaintClose"
  | "complaintSuccess"
  | "complaintReference"
  | "complaintAnonymous"
  | "complaintAnonymousHint"
  | "complaintContactLabel"
  | "complaintContact16699"
  | "complaintContactThisPhone"
  | "complaintContactNone"
  | "complaintWhenLabel"
  | "complaintLinkedCaseLabel"
  | "complaintWhoSees"
  | "complaintWhoSeesOfficer"
  | "complaintWhoSeesManager"
  | "complaintWhoSeesAnonymousPool"
  | "complaintConsent"
  | "complaintWhatNextTitle"
  | "complaintWhatNextCase"
  | "complaintWhatNextContact"
  | "complaintWhatNextDays"
  | "complaintLinkedTag"
  | "complaintAnonymousTag"
  | "navUdcOffice"
  | "navLodgeComplaint"
  | "myCasesHeading"
  | "myCasesIntro"
  | "myCasesEmpty"
  | "caseDetailHeading"
  | "caseDetailDeferred"
  | "backToMyCases"
  | "udcOfficeHeading"
  | "udcOfficeBody"
  | "complaintOralLabel"
  | "complaintOralPlaceholder"
  | "complaintModeLabel"
  | "complaintModeOral"
  | "complaintModeText"
  | "complaintCardMode"
  | "complaintCardReason"
  | "complaintCardContact"
  | "complaintStep1"
  | "complaintStep2"
  | "complaintStep3"
  | "complaintHelpTitle"
  | "complaintHelpFast"
  | "complaintHelpAudit"
  | "complaintHelpFair"
  | "previewHeading"
  | "previewReason"
  | "previewMode"
  | "previewCase"
  | "previewContact"
  | "previewDate"
  | "previewAnonymous"
  | "previewWhoSees"
  | "previewAnonymousYes"
  | "previewAnonymousNo"
  /* --- 5-step wizard redesign --- */
  | "stepLabel"
  | "stepOf"
  | "progress1"
  | "progress2"
  | "progress3"
  | "progress4"
  | "progress5"
  | "s1Headline"
  | "s1Sub"
  | "s2Headline"
  | "s2Question"
  | "s2Sub"
  | "s3Headline"
  | "s3Question"
  | "s3Sub"
  | "s4Headline"
  | "s4Sub"
  | "s4Promise"
  | "s5Headline"
  | "s5Sub"
  | "s5Confirm"
  | "nameLabel"
  | "namePlaceholder"
  | "phoneLabel"
  | "phonePlaceholder"
  | "proxyRelLabel"
  | "proxyRelPlaceholder"
  | "proxyNameLabel"
  | "proxyNamePlaceholder"
  | "proxyPhoneLabel"
  | "proxyPhonePlaceholder"
  | "proxySafety"
  | "voiceIdle"
  | "voiceListening"
  | "voiceProcessing"
  | "voiceDone"
  | "voiceMicName"
  | "voiceMicPhone"
  | "voiceMicDescription"
  | "voiceMicConsent"
  | "voiceSavedHint"
  | "actingSelfTitle"
  | "actingSelfSub"
  | "actingFamilyTitle"
  | "actingFamilySub"
  | "actingNeighborTitle"
  | "actingNeighborSub"
  | "dispute1Title"
  | "dispute1Sub"
  | "dispute1Eyebrow"
  | "dispute2Title"
  | "dispute2Sub"
  | "dispute2Eyebrow"
  | "dispute3Title"
  | "dispute3Sub"
  | "dispute3Eyebrow"
  | "dispute4Title"
  | "dispute4Sub"
  | "dispute4Eyebrow"
  | "dispute5Title"
  | "dispute5Sub"
  | "dispute5Eyebrow"
  | "dispute6Title"
  | "dispute6Sub"
  | "dispute6Eyebrow"
  | "slot1Title"
  | "slot1Sub"
  | "slot2Title"
  | "slot2Sub"
  | "slot3Title"
  | "slot3Sub"
  | "slot4Title"
  | "slot4Sub"
  | "consentStep1Title"
  | "consentStep1VoiceLabel"
  | "consentStep2Title"
  | "consentPhrase"
  | "consentConfirmBtn"
  | "consentLegal"
  | "reviewHeading"
  | "reviewApplicant"
  | "reviewPhone"
  | "reviewDispute"
  | "reviewContact"
  | "reviewOfficeName"
  | "backBtn"
  | "nextBtn"
  | "submitBtn"
  | "applyAgainBtn"
  | "previewEmpty"
  | "previewApplicant"
  | "previewDispute"
  | "previewActingFor"
  | "previewContactSlot"
  | "previewConsent"
  | "help1Title"
  | "help1Body"
  | "help2Title"
  | "help2Body"
  | "help3Title"
  | "help3Body"
  | "successTitle"
  | "successBody"
  | "successNext1"
  | "successNext2"
  | "successNext3"
  | "descLabel"
  | "descPlaceholder"
  | "descVoiceNoteAdded"
  | "specialInstrLabel"
  | "specialInstrPlaceholder"
  | "errName"
  | "errPhone"
  | "errActingFor"
  | "errProxyName"
  | "errProxyRel"
  | "errDispute"
  | "errContactSlot"
  | "errConsent"
  /* --- case-detail redesign --- */
  | "caseBackToMyCases"
  | "caseHeaderEyebrow"
  | "caseHeaderTitle"
  | "caseApplicant"
  | "caseBeneficiary"
  | "caseIssue"
  | "caseIdLabel"
  | "caseIdOffice"
  | "caseCopyLabel"
  | "caseCopiedLabel"
  | "caseStatusLabel"
  | "statusSubmitted"
  | "statusUnderReview"
  | "statusApproved"
  | "statusMediationStarted"
  | "statusAgreementPending"
  | "statusResolved"
  | "statusClosed"
  | "statusInProgress"
  | "statusUpcoming"
  | "nextActionHeading"
  | "nextActionSubmittedTitle"
  | "nextActionSubmittedBody"
  | "nextActionUnderReviewTitle"
  | "nextActionUnderReviewBody"
  | "nextActionMediationTitle"
  | "nextActionMediationBody"
  | "nextActionMediationHint"
  | "nextActionConfirmTime"
  | "nextActionAgreementTitle"
  | "nextActionAgreementBody"
  | "nextActionResolvedTitle"
  | "nextActionResolvedBody"
  | "nextActionResolvedHint"
  | "timelineHeading"
  | "timelineCompleted"
  | "timelineCurrent"
  | "timelineUpcoming"
  | "timelineNext"
  | "actionHeading"
  | "actionAudioUpdate"
  | "actionAudioUnavailable"
  | "actionViewAgreement"
  | "actionAgreementPending"
  | "actionFindUdc"
  | "actionAudioUnavailableHint"
  | "mediatorHeading"
  | "mediatorName"
  | "mediatorDesignation"
  | "mediatorArea"
  | "mediatorContactTime"
  | "mediatorNotAssigned"
  | "communicationHeading"
  | "communicationLatestFrom"
  | "communicationOpenThread"
  | "communicationClose"
  | "communicationEmpty"
  | "communicationYou"
  | "communicationMediator"
  | "documentsHeading"
  | "documentsEmpty"
  | "docApplication"
  | "docVoiceStatement"
  | "docIdProof"
  | "docAgreementDraft"
  | "docStatusFiled"
  | "docStatusVerified"
  | "docStatusPending"
  | "docViewLabel"
  | "docDownloadLabel"
  | "caseInfoHeading"
  | "caseInfoApplicant"
  | "caseInfoBeneficiary"
  | "caseInfoIssue"
  | "caseInfoSubmittedAt"
  | "caseInfoSafeTime"
  | "caseInfoOffice"
  | "safetyHeading"
  | "safetyBody"
  | "caseNotFoundHeading"
  | "caseNotFoundBody"
  | "errorCopyFailed"
  /* --- citizen sidebar + dashboard redesign --- */
  | "navHome"
  | "navNotifications"
  | "navMyUdcOffice"
  | "navLegalAidOfficer"
  | "navContactSupport"
  | "sidebarSectionMain"
  | "sidebarSectionMyCases"
  | "sidebarSectionUdc"
  | "homeGreetingMorning"
  | "homeGreetingAfternoon"
  | "homeGreetingEvening"
  | "homeHowCanWeHelp"
  | "homeActionLodgeTitle"
  | "homeActionLodgeDesc"
  | "homeActionMyCasesTitle"
  | "homeActionMyCasesDesc"
  | "homeActionUdcTitle"
  | "homeActionUdcDesc"
  | "homeActionStart"
  | "homeActionView"
  | "homeActionFind"
  | "homeRecentCases"
  | "homeViewCase"
  | "homeNoRecentCases"
  | "homeUpdatedOn"
  | "homeIssueLabel"
  | "notificationListHeading"
  | "notificationMarkAllRead"
  | "notificationAllCaughtUp"
  | "notificationAllCaughtUpSub"
  | "notification1Title"
  | "notification1Body"
  | "notification1Time"
  | "notification2Title"
  | "notification2Body"
  | "notification2Time"
  | "notification3Title"
  | "notification3Body"
  | "notification3Time"
  | "notification4Title"
  | "notification4Body"
  | "notification4Time"
  | "notification5Title"
  | "notification5Body"
  | "notification5Time"
  | "notificationReadBadge"
  | "notificationUnreadBadge"
  | "statusActive"
  | "statusNeedsAction"
  | "profileSettings"
  | "profileLogout"
  | "profileComingSoon"
  | "bottomNavHome"
  | "bottomNavLodge"
  | "bottomNavCases"
  | "bottomNavUdc"
  | "udcMyOfficeTitle"
  | "udcMyOfficeBody"
  | "udcOfficerTitle"
  | "udcOfficerBody"
  | "udcContactTitle"
  | "udcContactBody"
  | "udcTabOverview"
  | "udcTabOffice"
  | "udcTabOfficer"
  | "udcTabContact"
  | "udcComingSoonBody"
  | "notifBadgeLabel"
  | "homeIssueLabel"
  | "udcOverviewEyebrow"
  | "udcOverviewHeadline"
  | "udcOverviewIntro"
  | "udcKpiOffice"
  | "udcKpiOfficer"
  | "udcKpiOpenCases"
  | "udcKpiAvgResponse"
  | "udcStatusHeading"
  | "udcStatusOpen"
  | "udcStatusClosed"
  | "udcStatusNote"
  | "udcOfficeNameLabel"
  | "udcOfficeAddressLabel"
  | "udcOfficeAddressLine1"
  | "udcOfficeAddressLine2"
  | "udcOfficePhoneLabel"
  | "udcOfficeEmailLabel"
  | "udcOfficeHoursHeading"
  | "udcOfficeHoursSun"
  | "udcOfficeHoursSunClosed"
  | "udcOfficeHoursMon"
  | "udcOfficeHoursTue"
  | "udcOfficeHoursWed"
  | "udcOfficeHoursThu"
  | "udcOfficeHoursFri"
  | "udcOfficeHoursSat"
  | "udcOfficeHoursSatClosed"
  | "udcIntakeHeading"
  | "udcIntakeStep1"
  | "udcIntakeStep1Body"
  | "udcIntakeStep2"
  | "udcIntakeStep2Body"
  | "udcIntakeStep3"
  | "udcIntakeStep3Body"
  | "udcIntakeStep4"
  | "udcIntakeStep4Body"
  | "udcOfficerNameLabel"
  | "udcOfficerName"
  | "udcOfficerDesignation"
  | "udcOfficerArea"
  | "udcOfficerAreaValue"
  | "udcOfficerContactTime"
  | "udcOfficerContactTimeValue"
  | "udcOfficerAssignedCases"
  | "udcOfficerCasesCount"
  | "udcOfficerExperience"
  | "udcOfficerExperienceValue"
  | "udcServicesHeading"
  | "udcService1Title"
  | "udcService1Body"
  | "udcService2Title"
  | "udcService2Body"
  | "udcService3Title"
  | "udcService3Body"
  | "udcService4Title"
  | "udcService4Body"
  | "udcContactHeading"
  | "udcContactHotlineTitle"
  | "udcContactHotlineBody"
  | "udcContactHotlineNote"
  | "udcContactInAppTitle"
  | "udcContactInAppBody"
  | "udcContactWalkInTitle"
  | "udcContactWalkInBody"
  | "udcContactWalkInNote"
  | "udcContactEmailTitle"
  | "udcContactEmailBody"
  | "udcContactPostalTitle"
  | "udcContactPostalBody"
  | "udcContactPostalAddress"
  | "udcViewOnMap";

type Messages = Record<Lang, Record<MessageKey, string>>;

export const messages: Messages = {
  bn: {
    tagline: "বাংলাদেশের যাচাইকৃত আইনি সহায়তা কার্যপ্রণালী",
    signInTitle: "লগইন করুন",
    mobileNumber: "মোবাইল নম্বর",
    mobilePlaceholder: "01XXXXXXXXX",
    passwordLabel: "পাসওয়ার্ড",
    errorIdentifier: "মোবাইল নম্বর লিখুন।",
    errorPassword: "পাসওয়ার্ড লিখুন।",
    signingIn: "প্রবেশ করা হচ্ছে…",
    signInAction: "লগইন করুন",
    footer: "প্রোটোটাইপ · শুধুমাত্র সিমুলেটেড তথ্য",
    workspacePlaceholder:
      "এই ওয়ার্কস্পেসটি পরবর্তী ধাপে তৈরি হবে। লগইন প্রবাহটি সফল।",
    backToSignIn: "লগইন পৃষ্ঠায় ফিরুন",
    portalLinks: "অন্যান্য লগইন পোর্টাল",
    openMenu: "মেনু খুলুন",
    closeMenu: "মেনু বন্ধ করুন",
    simulated: "সিমুলেশন",
    simClock: "ঘড়ি",
    simSms: "এসএমএস",
    simCourt: "আদালত",
    simScenario: "পরিস্থিতি",
    simReset: "রিসেট",
    navMyCases: "আমার মামলা",
    navExpandCases: "মামলার তালিকা প্রসারিত করুন",
    navCollapseCases: "মামলার তালিকা সংকুচিত করুন",
    sidebarCaseItemLabel: "মামলা %d",
    sidebarCasePartySeparator: "বনাম",
    sidebarNoCases: "এখনো কোনো মামলা নেই",
    sidebarCasesGroupLabel: "মামলার তালিকা",
    navMessages: "বার্তা",
    navProfile: "প্রোফাইল",
    navActionQueue: "কার্যক্রম সারি",
    navCases: "মামলা",
    navAlerts: "সতর্কতা",
    navAssignments: "নিয়োগ",
    navTimeline: "সময়রেখা",
    navAssignedCases: "নিয়োগপ্রাপ্ত মামলা",
    navHearingReports: "শুনানির প্রতিবেদন",
    navCalendar: "ক্যালেন্ডার",
    navOverview: "সংক্ষেপ",
    navUsers: "ব্যবহারকারী",
    navRules: "নিয়ম ও থ্রেশহোল্ড",
    navMetrics: "মেট্রিক্স",
    navAudit: "নিবন্ধন",
    navFileComplaint: "অভিযোগ জানান",
    complaintTitle: "একটি অভিযোগ নথিভুক্ত করুন",
    complaintIntro:
      "আপনার আইনি সহায়তা প্রক্রিয়া নিয়ে কোনো সমস্যা হলে নিচের ফর্মটি পূরণ করুন। একজন কর্মকর্তা শীঘ্রই পর্যালোচনা করবেন।",
    complaintReasonLabel: "সমস্যার ধরন",
    complaintReasonNotResponding: "আইনজীবী যোগাযোগ করছেন না",
    complaintReasonAskedPayment: "আমার কাছে অর্থ চাওয়া হয়েছে",
    complaintReasonOther: "অন্য (নিচে লিখুন)",
    complaintOtherPlaceholder: "সংক্ষেপে লিখুন",
    complaintMessageLabel: "আপনার বার্তা (ঐচ্ছিক)",
    complaintMessagePlaceholder:
      "ঘটনা, তারিখ বা যা জানাতে চান তা এখানে লিখুন",
    complaintSubmit: "অভিযোগ জমা দিন",
    complaintClose: "বন্ধ করুন",
    complaintSuccess:
      "আপনার অভিযোগ নথিভুক্ত হয়েছে। একজন কর্মকর্তা শীঘ্রই পর্যালোচনা করবেন।",
    complaintReference: "রেফারেন্স নম্বর",
    complaintAnonymous: "বেনামে অভিযোগ করুন",
    complaintAnonymousHint:
      "আপনার নাম ও মামলার তথ্য এই অভিযোগের সাথে যুক্ত হবে না।",
    complaintContactLabel: "কীভাবে যোগাযোগ করবেন?",
    complaintContact16699: "১৬৬৯৯ নম্বরে কল ব্যাক",
    complaintContactThisPhone: "এই ফোন নম্বরে",
    complaintContactNone: "আমাকে যোগাযোগ করবেন না",
    complaintWhenLabel: "কখন ঘটেছে? (ঐচ্ছিক)",
    complaintLinkedCaseLabel: "কোন মামলা সম্পর্কে?",
    complaintWhoSees: "কে দেখবেন",
    complaintWhoSeesOfficer: "জেলা আইনি সহায়তা কর্মকর্তা",
    complaintWhoSeesManager: "প্যানেল আইনজীবী ব্যবস্থাপক",
    complaintWhoSeesAnonymousPool:
      "নাম প্রকাশ না করা অভিযোগ পর্যালোচনা প্যানেল",
    complaintConsent:
      "আমি নিশ্চিত করছি যে এই তথ্য আমার জানামতে সত্য।",
    complaintWhatNextTitle: "এরপর কী হবে",
    complaintWhatNextCase: "আপনার মামলা চলমান থাকবে।",
    complaintWhatNextContact:
      "আমরা শুধু আপনার বেছে নেওয়া মাধ্যমে যোগাযোগ করব।",
    complaintWhatNextDays: "৫ কর্মদিবসের মধ্যে আপনি জানতে পারবেন।",
    complaintLinkedTag: "মামলার সাথে যুক্ত",
    complaintAnonymousTag: "বেনামে",
    navUdcOffice: "ইউডিসি কার্যালয়",
    navLodgeComplaint: "অভিযোগ দাখিল",
    myCasesHeading: "আমার মামলাসমূহ",
    myCasesIntro:
      "আপনার বর্তমান মামলাগুলোর তালিকা। যেকোনো মামলায় ক্লিক করলে বিস্তারিত দেখতে পারবেন।",
    myCasesEmpty: "এখনো কোনো মামলা নেই।",
    caseDetailHeading: "মামলা",
    caseDetailDeferred:
      "এই মামলার বিস্তারিত বিষয়বস্তু পরবর্তী ধাপে যোগ করা হবে।",
    backToMyCases: "← আমার মামলায় ফিরুন",
    udcOfficeHeading: "ইউডিসি কার্যালয়",
    udcOfficeBody:
      "ইউডিসি (আন্তঃবিরোধ নিষ্পত্তি কেন্দ্র) কার্যালয়ের সেবা শীঘ্রই যোগ হবে।",
    complaintOralLabel: "মৌখিক বক্তব্য (ঐচ্ছিক)",
    complaintOralPlaceholder:
      "আপনার মৌখিক বক্তব্য এখানে লিখুন বা পেস্ট করুন",
    complaintModeLabel: "কীভাবে জানাতে চান?",
    complaintModeOral: "মৌখিক বক্তব্য",
    complaintModeText: "লিখিত বক্তব্য",
    complaintCardMode: "কীভাবে জানাতে চান?",
    complaintCardReason: "সমস্যাটি কী?",
    complaintCardContact: "আমরা কীভাবে যোগাযোগ করব?",
    complaintStep1: "০১ · পদ্ধতি",
    complaintStep2: "০২ · কারণ",
    complaintStep3: "০৩ · যোগাযোগ ও জমা",
    complaintHelpTitle: "কীভাবে পর্যালোচনা হয়",
    complaintHelpFast: "৫ কর্মদিবসের মধ্যে ফলাফল",
    complaintHelpAudit: "প্রতিটি পদক্ষেপ নিবন্ধিত থাকে",
    complaintHelpFair: "কারণ ছাড়া কোনো সিদ্ধান্ত হয় না",
    previewHeading: "আপনার অভিযোগ এক নজরে",
    previewReason: "কারণ",
    previewMode: "পদ্ধতি",
    previewCase: "মামলা",
    previewContact: "যোগাযোগ",
    previewDate: "ঘটনার তারিখ",
    previewAnonymous: "বেনামে",
    previewWhoSees: "কে দেখবেন",
    previewAnonymousYes: "হ্যাঁ",
    previewAnonymousNo: "না",

    /* 5-step wizard — bn */
    stepLabel: "ধাপ",
    stepOf: "৫",
    progress1: "পরিচয়",
    progress2: "পক্ষে",
    progress3: "সমস্যা",
    progress4: "সময়",
    progress5: "সম্মতি",
    s1Headline: "আপনার নাম বলুন বা লিখুন",
    s1Sub:
      "ভয়েস মাইক চেপে মুখে নাম বলতে পারেন অথবা সরাসরি নিচের টেক্সট বক্সে টাইপ করুন।",
    s2Headline: "ধাপ ২ • কার পক্ষে আবেদন",
    s2Question: "আপনি কার পক্ষে আবেদন করছেন?",
    s2Sub:
      "নিজে সরাসরি অথবা পরিবারের কোনো অসহায় সদস্যের পক্ষ থেকেও প্রক্সি আবেদন করতে পারেন।",
    s3Headline: "ধাপ ৩ • বিরোধের প্রকৃতি",
    s3Question: "সমস্যার ধরন নির্বাচন করুন",
    s3Sub: "নিচের কার্ডগুলো থেকে প্রধান সমস্যাটি বেছে নিন",
    s4Headline: "ধাপ ৪ • কখন নিরাপদে কথা বলতে পারেন?",
    s4Sub:
      "আপনার পরিবারের অন্য কেউ উপস্থিত থাকা বা ঝামেলার ঝুঁকি এড়াতে নিরাপদ সময় নির্বাচন করুন।",
    s4Promise:
      "বিশেষ অঙ্গীকার: আমরা শুধুমাত্র এই নির্দিষ্ট সময়েই যোগাযোগ করব। আপনার অনুমতি ছাড়া অন্য সময় কোনো কল বা এসএমএস যাবে না।",
    s5Headline: "ধাপ ৫ • চূড়ান্ত সম্মতি",
    s5Sub: "প্রক্সি ও আইনি সহায়তা সম্মতি",
    s5Confirm:
      "আইনগত সুরক্ষার জন্য ভয়েস রেকর্ডিং বা মৌখিক সম্মতি প্রদান করুন।",
    nameLabel: "আপনার নাম (সরাসরি লিখুন বা নিচে মাইকে বলুন)",
    namePlaceholder: "এখানে নাম লিখুন…",
    phoneLabel: "আপনার মোবাইল নম্বর (যেখানে এসএমএস বা কল পাবেন)",
    phonePlaceholder: "০১XXXXXXXXX",
    proxyRelLabel: "সম্পর্ক",
    proxyRelPlaceholder: "যেমন: বোন",
    proxyNameLabel: "তার নাম (যিনি ভুক্তভোগী)",
    proxyNamePlaceholder: "ভুক্তভোগীর নাম লিখুন",
    proxyPhoneLabel: "তার ফোন নম্বর (ঐচ্ছিক - যদি আলাদা থাকে)",
    proxyPhonePlaceholder: "ফোন নম্বর দিন",
    proxySafety:
      "নিরাপত্তাজনিত কারণে তার কাছে ফোন করা ঝুঁকিপূর্ণ হলে এই ঘরটি ফাঁকা রাখতে পারেন।",
    voiceIdle: "মাইকে বলুন",
    voiceListening: "শুনছি…",
    voiceProcessing: "ভাবছি…",
    voiceDone: "সংরক্ষিত",
    voiceMicName: "মাইকে মুখে বলুন",
    voiceMicPhone: "মোবাইল নম্বর বলুন",
    voiceMicDescription: "মুখে রেকর্ড করুন",
    voiceMicConsent: "মাইকে মুখে সম্মতি দিন",
    voiceSavedHint: "সংরক্ষিত",
    actingSelfTitle: "নিজের পক্ষে",
    actingSelfSub: "আমি নিজেই ভুক্তভোগী",
    actingFamilyTitle: "পরিবারের সদস্য",
    actingFamilySub: "বোন, মা, ভাই বা আত্মীয়র পক্ষে",
    actingNeighborTitle: "প্রতিবেশী/বন্ধু",
    actingNeighborSub: "জরুরি সহায়তাকারী হিসেবে",
    dispute1Title: "পারিবারিক সহিংসতা",
    dispute1Sub: "শারীরিক বা মানসিক নির্যাতন",
    dispute1Eyebrow: "জরুরি অগ্রাধিকার",
    dispute2Title: "ভরণপোষণ বন্ধ",
    dispute2Sub: "স্ত্রী বা সন্তানের নিয়মিত খরচ বন্ধ",
    dispute2Eyebrow: "সাধারণ সালিশ",
    dispute3Title: "যৌতুক দাবি",
    dispute3Sub: "টাকা বা জিনিসপত্রের জন্য চাপ",
    dispute3Eyebrow: "আইনি নজরদারি",
    dispute4Title: "জমি/সম্পত্তি বিরোধ",
    dispute4Sub: "সীমানা, বণ্টন বা দখলের ঝামেলা",
    dispute4Eyebrow: "দলিল পর্যালোচনা",
    dispute5Title: "শিশু হেফাজত",
    dispute5Sub: "সন্তানের দেখাশোনা ও অধিকার",
    dispute5Eyebrow: "শিশু সুরক্ষা",
    dispute6Title: "অন্যান্য বিরোধ",
    dispute6Sub: "লেনদেন বা অন্যান্য দেনা-পাওনা",
    dispute6Eyebrow: "বিশেষ পর্যালোচনা",
    slot1Title: "শুক্রবার সকাল ১০-১০:৩০",
    slot1Sub: "ছুটির দিনের শান্ত পরিবেশ",
    slot2Title: "স্বামী কাজে থাকলে",
    slot2Sub: "সকাল ১১টা থেকে দুপুর ২টার মধ্যে",
    slot3Title: "সন্ধ্যা ৭-৮ টা",
    slot3Sub: "দিনের কাজ শেষ করার পর",
    slot4Title: "যেকোনো সময়",
    slot4Sub: "জরুরি বা সাধারণ যেকোনো কর্মদিবসে",
    consentStep1Title: "পদ্ধতি ১: মাইকে চাপ দিয়ে বলুন",
    consentStep1VoiceLabel: "“আমি এই আবেদন করার পূর্ণ সম্মতি দিচ্ছি”",
    consentStep2Title:
      "পদ্ধতি ২: অথবা সরাসরি টাইপ করে সম্মতি নিশ্চিত করুন",
    consentPhrase: "আমি এই আবেদন করার পূর্ণ সম্মতি দিচ্ছি",
    consentConfirmBtn: "সম্মতি নিশ্চিত করুন",
    consentLegal:
      "জাতীয় আইনি সহায়তা আইনের বিধান অনুসারে তৃতীয় পক্ষের মাধ্যমে সমঝোতার উদ্যোগ গ্রহণের বৈধতা নিশ্চিত করা হয়।",
    reviewHeading: "আবেদনের সারসংক্ষেপ",
    reviewApplicant: "আবেদনকারী",
    reviewPhone: "যোগাযোগ",
    reviewDispute: "সমস্যা",
    reviewContact: "নিরাপদ সময়",
    reviewOfficeName: "জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র",
    backBtn: "পেছনে",
    nextBtn: "পরবর্তী ধাপ",
    submitBtn: "আবেদন জমা দিন",
    applyAgainBtn: "আরেকটি আবেদন করুন",
    previewEmpty:
      "আপনি তথ্য পূরণ করলে এখানে তার সংক্ষিপ্ত বিবরণ দেখা যাবে।",
    previewApplicant: "আবেদনকারী",
    previewDispute: "সমস্যা",
    previewActingFor: "পক্ষে",
    previewContactSlot: "নিরাপদ সময়",
    previewConsent: "সম্মতি",
    help1Title: "তথ্য দিন",
    help1Body: "আপনার সমস্যা সহজ ভাষায় লিখুন বা মুখে বলুন।",
    help2Title: "নিরাপদ সময় বেছে নিন",
    help2Body: "আপনার সুবিধামতো সময়ে আমরা যোগাযোগের চেষ্টা করব।",
    help3Title: "কারণ ছাড়া কোনো সিদ্ধান্ত নয়",
    help3Body: "আপনার বক্তব্য ও তথ্য যাচাই করে পরবর্তী পদক্ষেপ নেওয়া হবে।",
    successTitle: "আবেদন গৃহীত হয়েছে",
    successBody:
      "আপনার আবেদন নথিভুক্ত হয়েছে। নির্দিষ্ট সময়ে আমরা আপনার সাথে যোগাযোগ করব।",
    successNext1: "৫ কর্মদিবসের মধ্যে আমরা আপনাকে জানাব।",
    successNext2: "নির্বাচিত সময়ের বাইরে কোনো যোগাযোগ যাবে না।",
    successNext3: "আবেদনের সব ধাপ নিবন্ধিত থাকবে।",
    descLabel: "সমস্যার অতিরিক্ত বিবরণ (মুখে বলুন বা লিখুন)",
    descPlaceholder: "এখানে সরাসরি লিখতে পারেন…",
    descVoiceNoteAdded: "ভয়েস নোট যুক্ত হয়েছে (০:২৮ সেকেন্ড)",
    specialInstrLabel: "বিশেষ কোনো নির্দেশনা (ঐচ্ছিক)",
    specialInstrPlaceholder: "যেমন: শুধুমাত্র হোয়াটসঅ্যাপে বার্তা পাঠাবেন…",
    errName: "দয়া করে আপনার নাম লিখুন।",
    errPhone: "যোগাযোগের জন্য একটি মোবাইল নম্বর দিন।",
    errActingFor: "অনুগ্রহ করে একটি বিকল্প বেছে নিন।",
    errProxyName: "ভুক্তভোগীর নাম লিখুন।",
    errProxyRel: "সম্পর্ক নির্বাচন করুন।",
    errDispute: "অনুগ্রহ করে সমস্যার ধরন বেছে নিন।",
    errContactSlot: "একটি নিরাপদ সময় বেছে নিন।",
    errConsent: "আবেদন জমা দিতে সম্মতি দিন।",

    /* case-detail — bn */
    caseBackToMyCases: "← আমার মামলায় ফিরে যান",
    caseHeaderEyebrow: "সরকারি অনলাইন বিরোধ নিষ্পত্তি",
    caseHeaderTitle: "আপনার মামলার অবস্থা",
    caseApplicant: "আবেদনকারী",
    caseBeneficiary: "যার পক্ষে আবেদন",
    caseIssue: "সমস্যা",
    caseIdLabel: "মামলা আইডি",
    caseIdOffice: "অফিস",
    caseCopyLabel: "কপি",
    caseCopiedLabel: "কপি হয়েছে",
    caseStatusLabel: "বর্তমান অবস্থা",
    statusSubmitted: "আবেদন জমা হয়েছে",
    statusUnderReview: "পর্যালোচনা চলছে",
    statusApproved: "অনুমোদিত",
    statusMediationStarted: "মধ্যস্থতা শুরু হয়েছে",
    statusAgreementPending: "চুক্তি অপেক্ষমান",
    statusResolved: "নিষ্পত্তি হয়েছে",
    statusClosed: "বন্ধ",
    statusInProgress: "চলমান",
    statusUpcoming: "পরবর্তী ধাপ",
    nextActionHeading: "পরবর্তী পদক্ষেপ",
    nextActionSubmittedTitle: "আবেদন জমা হয়েছে",
    nextActionSubmittedBody:
      "আপনার আবেদন সফলভাবে গ্রহণ করা হয়েছে। পরবর্তী ধাপে একজন কর্মকর্তা আপনার তথ্য পর্যালোচনা করবেন।",
    nextActionUnderReviewTitle: "আপনার আবেদন পর্যালোচনা করা হচ্ছে",
    nextActionUnderReviewBody:
      "একজন কর্মকর্তা আপনার দেওয়া তথ্য যাচাই করছেন।",
    nextActionMediationTitle: "মধ্যস্থতাকারী শীঘ্রই আপনার সাথে যোগাযোগ করবেন",
    nextActionMediationBody:
      "শুক্রবার সকাল ১০–১০:৩০ টায় নির্ধারিত সময়ে কল আসবে। প্রস্তুত থাকুন: আপনার কথা বলার সময়সীমা ১৫ মিনিট।",
    nextActionMediationHint:
      "নির্ধারিত সময়ের আগে আপনার ফোনে একটি নোটিফিকেশন পাঠানো হবে।",
    nextActionConfirmTime: "নিরাপদ সময় নিশ্চিত করুন",
    nextActionAgreementTitle: "চুক্তি পর্যালোচনা করুন",
    nextActionAgreementBody:
      "মধ্যস্থতার ফলাফল আপনার অনুমোদনের অপেক্ষায় রয়েছে।",
    nextActionResolvedTitle: "মামলাটি নিষ্পত্তি হয়েছে",
    nextActionResolvedBody:
      "আপনার মামলার প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে।",
    nextActionResolvedHint: "প্রয়োজনে চুক্তির খসড়া এখনো ডাউনলোড করতে পারেন।",
    timelineHeading: "মামলার বর্তমান অগ্রগতি",
    timelineCompleted: "সম্পন্ন",
    timelineCurrent: "চলমান",
    timelineUpcoming: "আসন্ন",
    timelineNext: "পরবর্তী ধাপ",
    actionHeading: "জরুরি অ্যাকশন ও যোগাযোগ",
    actionAudioUpdate: "অডিও আপডেট শুনুন",
    actionAudioUnavailable: "অডিও এখন প্রোটোটাইপে উপলব্ধ নয়",
    actionAudioUnavailableHint:
      "ভবিষ্যতে এখানে টেপা করা আপডেট বাজানো হবে।",
    actionViewAgreement: "চুক্তির খসড়া দেখুন ও ডাউনলোড",
    actionAgreementPending: "চুক্তির খসড়া এখনো প্রস্তুত হয়নি",
    actionFindUdc: "নিকটতম ইউডিসি খুঁজুন",
    mediatorHeading: "মধ্যস্থতাকারীর পরিচিতি",
    mediatorName: "নাম",
    mediatorDesignation: "পদবি",
    mediatorArea: "এলাকা",
    mediatorContactTime: "অনুমোদিত যোগাযোগের সময়",
    mediatorNotAssigned: "এখনো কোনো মধ্যস্থতাকারী নির্ধারণ করা হয়নি।",
    communicationHeading: "মধ্যস্থতাকারীর কথোপকথন হাইলাইটস",
    communicationLatestFrom: "উত্তর প্রাপ্ত",
    communicationOpenThread: "সম্পূর্ণ মেসেজ থ্রেড দেখুন",
    communicationClose: "বন্ধ করুন",
    communicationEmpty: "এখনো কোনো বার্তা নেই।",
    communicationYou: "আপনি",
    communicationMediator: "মধ্যস্থতাকারী",
    documentsHeading: "মামলার নথিপত্র",
    documentsEmpty: "এখনো কোনো নথি যুক্ত হয়নি।",
    docApplication: "আবেদনপত্র",
    docVoiceStatement: "ভয়েস বিবৃতি",
    docIdProof: "পরিচয়পত্র",
    docAgreementDraft: "চুক্তির খসড়া",
    docStatusFiled: "জমা হয়েছে",
    docStatusVerified: "যাচাই সম্পন্ন",
    docStatusPending: "অপেক্ষমান",
    docViewLabel: "দেখুন",
    docDownloadLabel: "ডাউনলোড",
    caseInfoHeading: "মামলার তথ্য",
    caseInfoApplicant: "আবেদনকারী",
    caseInfoBeneficiary: "যার পক্ষে আবেদন",
    caseInfoIssue: "সমস্যার ধরন",
    caseInfoSubmittedAt: "আবেদনের তারিখ",
    caseInfoSafeTime: "যোগাযোগের নিরাপদ সময়",
    caseInfoOffice: "অফিস",
    safetyHeading: "আপনার তথ্য সুরক্ষিত",
    safetyBody:
      "আপনার দেওয়া তথ্য শুধুমাত্র এই মামলার প্রয়োজনীয় প্রক্রিয়ায় ব্যবহার করা হবে। আপনার নির্ধারিত নিরাপদ সময়ের বাইরে যোগাযোগ করা হবে না।",
    caseNotFoundHeading: "এই মামলার তথ্য এখনো প্রস্তুত হয়নি",
    caseNotFoundBody: "অনুগ্রহ করে পরে আবার চেষ্টা করুন।",
    errorCopyFailed: "কপি করা যায়নি।",
    /* --- citizen sidebar + dashboard redesign --- */
    navHome: "হোম",
    navNotifications: "বিজ্ঞপ্তি",
    navMyUdcOffice: "আমার ইউডিসি অফিস",
    navLegalAidOfficer: "আইনি সহায়তা কর্মকর্তা",
    navContactSupport: "যোগাযোগ ও সহায়তা",
    sidebarSectionMain: "প্রধান",
    sidebarSectionMyCases: "আমার মামলা",
    sidebarSectionUdc: "ইউডিসি অফিস",
    homeGreetingMorning: "শুভ সকাল",
    homeGreetingAfternoon: "শুভ দুপুর",
    homeGreetingEvening: "শুভ সন্ধ্যা",
    homeHowCanWeHelp: "আজ আমরা কীভাবে সাহায্য করতে পারি?",
    homeActionLodgeTitle: "অভিযোগ দায়ের করুন",
    homeActionLodgeDesc: "কী ঘটেছে তা জানান — কণ্ঠ বা লিখে।",
    homeActionMyCasesTitle: "আমার মামলা",
    homeActionMyCasesDesc: "আপনার সক্রিয় মামলার অগ্রগতি দেখুন।",
    homeActionUdcTitle: "ইউডিসি অফিস",
    homeActionUdcDesc: "নিকটস্থ আইনি সহায়তা কেন্দ্র ও কর্মকর্তা।",
    homeActionStart: "শুরু করুন",
    homeActionView: "দেখুন",
    homeActionFind: "খুঁজুন",
    homeRecentCases: "সাম্প্রতিক মামলা",
    homeViewCase: "মামলা দেখুন",
    homeNoRecentCases: "আপনি এখনো কোনো অভিযোগ দায়ের করেননি।",
    homeUpdatedOn: "হালনাগাদ",
    notificationListHeading: "বিজ্ঞপ্তি",
    notificationMarkAllRead: "সব পঠিত হিসেবে চিহ্নিত করুন",
    notificationAllCaughtUp: "সব বিজ্ঞপ্তি পঠিত",
    notificationAllCaughtUpSub: "আপনি সবকিছু দেখে ফেলেছেন।",
    notification1Title: "আবেদন গৃহীত হয়েছে",
    notification1Body: "আপনার আবেদন কর্মকর্তার পর্যালোচনায় আছে।",
    notification1Time: "২ ঘণ্টা আগে",
    notification2Title: "মধ্যস্থতাকারী উত্তর দিয়েছেন",
    notification2Body: "“আমরা আপনার বক্তব্য ও নথিপত্র পেয়েছি।”",
    notification2Time: "১৮ সেপ্টেম্বর, ৪:২০ PM",
    notification3Title: "জাতীয় পরিচয়পত্র যাচাই সম্পন্ন",
    notification3Body: "আপনার জাতীয় পরিচয়পত্র সফলভাবে যাচাই হয়েছে।",
    notification3Time: "১৭ সেপ্টেম্বর",
    notification4Title: "চুক্তির খসড়া প্রস্তুত",
    notification4Body: "আপনার মধ্যস্থতাকারী চুক্তির খসড়া তৈরি করেছেন।",
    notification4Time: "১৪ সেপ্টেম্বর",
    notification5Title: "প্রোফাইল অসম্পূর্ণ",
    notification5Body: "নিরাপদ যোগাযোগের সময় যোগ করুন যাতে আমরা পৌঁছাতে পারি।",
    notification5Time: "১২ সেপ্টেম্বর",
    notificationReadBadge: "পঠিত",
    notificationUnreadBadge: "নতুন",
    statusActive: "সক্রিয়",
    statusNeedsAction: "পদক্ষেপ প্রয়োজন",
    profileSettings: "সেটিংস",
    profileLogout: "লগ আউট",
    profileComingSoon: "শীঘ্রই আসছে",
    bottomNavHome: "হোম",
    bottomNavLodge: "অভিযোগ",
    bottomNavCases: "মামলা",
    bottomNavUdc: "ইউডিসি",
    udcMyOfficeTitle: "আমার ইউডিসি অফিস",
    udcMyOfficeBody:
      "আপনার এলাকার জেলা আইনি সহায়তা কেন্দ্রের ঠিকানা, যোগাযোগের সময় ও পরিদর্শনের নিয়ম।",
    udcOfficerTitle: "আইনি সহায়তা কর্মকর্তা",
    udcOfficerBody:
      "নির্ধারিত কর্মকর্তা আপনার আবেদন যাচাই করেন এবং প্রয়োজনে প্যানেল মধ্যস্থতাকারী নির্বাচন করেন।",
    udcContactTitle: "যোগাযোগ ও সহায়তা",
    udcContactBody:
      "সরাসরি অফিসে আসতে না পারলে ১৬৬৯৯ নম্বরে কল করুন অথবা এই অ্যাপের মাধ্যমে বার্তা পাঠান।",
    udcTabOverview: "সারসংক্ষেপ",
    udcTabOffice: "অফিস",
    udcTabOfficer: "কর্মকর্তা",
    udcTabContact: "যোগাযোগ",
    udcComingSoonBody: "এই অংশটি শীঘ্রই যোগ করা হবে।",
    notifBadgeLabel: "নতুন",
    homeIssueLabel: "বিষয়",
    /* --- UDC section mock content --- */
    udcOverviewEyebrow: "সারসংক্ষেপ",
    udcOverviewHeadline: "আপনার ইউডিসি অফিসের সাম্প্রতিক চিত্র",
    udcOverviewIntro:
      "আপনার এলাকার জেলা আইনি সহায়তা কেন্দ্র, নিয়োজিত কর্মকর্তা ও চলমান মামলার সংক্ষিপ্ত চিত্র।",
    udcKpiOffice: "সক্রিয় অফিস",
    udcKpiOfficer: "কর্মকর্তা নিয়োজিত",
    udcKpiOpenCases: "চলমান মামলা",
    udcKpiAvgResponse: "গড় প্রতিক্রিয়া",
    udcStatusHeading: "অফিস সেবার স্থিতি",
    udcStatusOpen: "আজ খোলা",
    udcStatusClosed: "আজ বন্ধ",
    udcStatusNote: "সাপ্তাহিক ছুটি: শুক্রবার। জরুরি হটলাইন ২৪ ঘণ্টা চালু।",
    udcOfficeNameLabel: "অফিসের নাম",
    udcOfficeAddressLabel: "ঠিকানা",
    udcOfficeAddressLine1: "জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র",
    udcOfficeAddressLine2: "পুরাতন কোর্ট ভবন, ২য় তলা, পাঁচবিবি, জয়পুরহাট",
    udcOfficePhoneLabel: "ফোন",
    udcOfficeEmailLabel: "ইমেইল",
    udcOfficeHoursHeading: "খোলার সময়",
    udcOfficeHoursSun: "রবিবার",
    udcOfficeHoursSunClosed: "বন্ধ",
    udcOfficeHoursMon: "সোমবার",
    udcOfficeHoursTue: "মঙ্গলবার",
    udcOfficeHoursWed: "বুধবার",
    udcOfficeHoursThu: "বৃহস্পতিবার",
    udcOfficeHoursFri: "শুক্রবার",
    udcOfficeHoursSat: "শনিবার",
    udcOfficeHoursSatClosed: "বন্ধ",
    udcIntakeHeading: "আবেদন গ্রহণের নিয়ম",
    udcIntakeStep1: "পরিচয় যাচাই",
    udcIntakeStep1Body:
      "জাতীয় পরিচয়পত্র বা জন্ম নিবন্ধন সহ নিকটস্থ কেন্দ্রে আসুন।",
    udcIntakeStep2: "প্রাথমিক কথোপকথন",
    udcIntakeStep2Body:
      "কর্মকর্তা আপনার সমস্যা শুনবেন ও যোগ্যতা যাচাই করবেন (২০–৩০ মিনিট)।",
    udcIntakeStep3: "নথি গ্রহণ",
    udcIntakeStep3Body:
      "প্রয়োজনীয় কাগজপত্র ও ভয়েস বক্তব্য রেকর্ড করা হবে।",
    udcIntakeStep4: "মধ্যস্থতাকারী নির্ধারণ",
    udcIntakeStep4Body:
      "যোগ্য প্রমাণিত হলে ৪৮ ঘণ্টার মধ্যে প্যানেল মধ্যস্থতাকারী নির্বাচন করা হবে।",
    udcOfficerNameLabel: "কর্মকর্তার নাম",
    udcOfficerName: "মোঃ আনোয়ার হোসেন",
    udcOfficerDesignation: "জেলা আইনি সহায়তা কর্মকর্তা (DLASO)",
    udcOfficerArea: "দায়িত্বপূর্ণ এলাকা",
    udcOfficerAreaValue: "জয়পুরহাট সদর ও পাঁচবিবি উপজেলা",
    udcOfficerContactTime: "যোগাযোগের নিরাপদ সময়",
    udcOfficerContactTimeValue: "রবিবার–বৃহস্পতিবার, বিকেল ৩–৫টা",
    udcOfficerAssignedCases: "নিয়োজিত মামলা",
    udcOfficerCasesCount: "১৮টি (চলমান ৬)",
    udcOfficerExperience: "অভিজ্ঞতা",
    udcOfficerExperienceValue: "৮ বছর · ২৪০+ মামলা",
    udcServicesHeading: "কর্মকর্তা যেসব সেবা দেন",
    udcService1Title: "যোগ্যতা যাচাই",
    udcService1Body:
      "আবেদনকারীর আর্থিক ও সামাজিক যোগ্যতা যাচাই করে আইনি সহায়তার সুপারিশ করা।",
    udcService2Title: "মধ্যস্থতাকারী নির্বাচন",
    udcService2Body:
      "মামলার প্রকৃতি অনুযায়ী প্যানেল মধ্যস্থতাকারী নির্বাচন ও বরাদ্দ।",
    udcService3Title: "শুনানি সমন্বয়",
    udcService3Body:
      "আদালতের শুনানির তারিখ ও সময় নাগরিক ও আইনজীবীর সঙ্গে সমন্বয়।",
    udcService4Title: "নথি যাচাই ও সংরক্ষণ",
    udcService4Body:
      "জাতীয় পরিচয়পত্র, ভয়েস বক্তব্য ও চুক্তির খসড়া ডিজিটালি যাচাই ও সংরক্ষণ।",
    udcContactHeading: "আমাদের সঙ্গে যোগাযোগ",
    udcContactHotlineTitle: "জাতীয় হটলাইন",
    udcContactHotlineBody: "১৬৬৯৯ — সারাদেশ থেকে টোল-ফ্রি",
    udcContactHotlineNote: "২৪ ঘণ্টা চালু · বাংলা ও ইংরেজি",
    udcContactInAppTitle: "অ্যাপের মাধ্যমে",
    udcContactInAppBody:
      "বিজ্ঞপ্তি বা মামলার পেজ থেকে সরাসরি কর্মকর্তাকে বার্তা পাঠান।",
    udcContactWalkInTitle: "সরাসরি অফিসে",
    udcContactWalkInBody:
      "খোলার সময়ের মধ্যে যেকোনো কর্মদিবসে সরাসরি আসুন।",
    udcContactWalkInNote: "পরিচয়পত্র সঙ্গে আনতে ভুলবেন না।",
    udcContactEmailTitle: "ইমেইল",
    udcContactEmailBody: "joypurhat.dlaso@example.gov.bd",
    udcContactPostalTitle: "ডাক যোগাযোগ",
    udcContactPostalBody:
      "লিখিত আবেদন বা অভিযোগ ডাকযোগে পাঠাতে পারেন।",
    udcContactPostalAddress:
      "জেলা আইনি সহায়তা অফিস, পুরাতন কোর্ট ভবন, জয়পুরহাট-৫৯০০",
    udcViewOnMap: "মানচিত্রে দেখুন",
  },
  en: {
    tagline: "Verified legal aid operations",
    signInTitle: "Sign in",
    mobileNumber: "Mobile number",
    mobilePlaceholder: "01XXXXXXXXX",
    passwordLabel: "Password",
    errorIdentifier: "Enter your mobile number.",
    errorPassword: "Enter your password.",
    signingIn: "Signing in…",
    signInAction: "Sign in",
    footer: "Prototype · simulated data only",
    workspacePlaceholder:
      "This workspace is built in a later step. The sign-in flow works.",
    backToSignIn: "Back to sign in",
    portalLinks: "Other sign-in portals",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    simulated: "Simulated",
    simClock: "Clock",
    simSms: "SMS",
    simCourt: "Court",
    simScenario: "Scenario",
    simReset: "Reset",
    navMyCases: "My Cases",
    navExpandCases: "Expand case list",
    navCollapseCases: "Collapse case list",
    sidebarCaseItemLabel: "Case %d",
    sidebarCasePartySeparator: "vs",
    sidebarNoCases: "No cases yet",
    sidebarCasesGroupLabel: "Case list",
    navMessages: "Messages",
    navProfile: "Profile",
    navActionQueue: "Action Queue",
    navCases: "Cases",
    navAlerts: "Alerts",
    navAssignments: "Assignments",
    navTimeline: "Timeline",
    navAssignedCases: "Assigned Cases",
    navHearingReports: "Hearing Reports",
    navCalendar: "Calendar",
    navOverview: "Overview",
    navUsers: "Users",
    navRules: "Rules & Thresholds",
    navMetrics: "Metrics",
    navAudit: "Audit Log",
    navFileComplaint: "File a complaint",
    complaintTitle: "File a complaint",
    complaintIntro:
      "If something has gone wrong with your legal aid, use this form to tell the office. An officer will review it.",
    complaintReasonLabel: "Reason",
    complaintReasonNotResponding: "Lawyer is not responding",
    complaintReasonAskedPayment: "I have been asked to pay",
    complaintReasonOther: "Other (please describe)",
    complaintOtherPlaceholder: "Brief description",
    complaintMessageLabel: "Your message (optional)",
    complaintMessagePlaceholder: "What happened, when, or anything else",
    complaintSubmit: "Submit complaint",
    complaintClose: "Close",
    complaintSuccess:
      "Your complaint was recorded. An officer will review it soon.",
    complaintReference: "Reference number",
    complaintAnonymous: "File this complaint anonymously",
    complaintAnonymousHint:
      "Your name and case details will not be linked to this complaint.",
    complaintContactLabel: "How should we contact you?",
    complaintContact16699: "16699 call back",
    complaintContactThisPhone: "This phone number",
    complaintContactNone: "Do not contact me",
    complaintWhenLabel: "When did this happen? (optional)",
    complaintLinkedCaseLabel: "Which case is this about?",
    complaintWhoSees: "Who will see this",
    complaintWhoSeesOfficer: "District Legal Aid Officer",
    complaintWhoSeesManager: "Panel Lawyer Manager",
    complaintWhoSeesAnonymousPool: "Anonymous review panel",
    complaintConsent:
      "I confirm this information is true to the best of my knowledge.",
    complaintWhatNextTitle: "What happens next",
    complaintWhatNextCase: "Your case continues as normal.",
    complaintWhatNextContact:
      "We will contact you only through the channel you chose.",
    complaintWhatNextDays:
      "You will hear from us within 5 working days.",
    complaintLinkedTag: "Linked to case",
    complaintAnonymousTag: "Anonymous",
    navUdcOffice: "UDC Office",
    navLodgeComplaint: "Lodge a Complaint",
    myCasesHeading: "My Cases",
    myCasesIntro:
      "List of your active cases. Click any case to see its detail.",
    myCasesEmpty: "You have no cases yet.",
    caseDetailHeading: "CASE",
    caseDetailDeferred:
      "Detailed case processing will be implemented in a later phase.",
    backToMyCases: "← Back to my cases",
    udcOfficeHeading: "UDC Office",
    udcOfficeBody:
      "Services from the UDC (Union Dispute Centre) office will be added in a later phase.",
    complaintOralLabel: "Oral statement (optional)",
    complaintOralPlaceholder:
      "Type or paste your oral statement here",
    complaintModeLabel: "How would you like to share?",
    complaintModeOral: "Oral statement",
    complaintModeText: "Written statement",
    complaintCardMode: "How do you want to share?",
    complaintCardReason: "What's the reason?",
    complaintCardContact: "How should we reach you?",
    complaintStep1: "01 · Method",
    complaintStep2: "02 · Reason",
    complaintStep3: "03 · Contact & submit",
    complaintHelpTitle: "How this is reviewed",
    complaintHelpFast: "Outcome in 5 working days",
    complaintHelpAudit: "Every step is logged",
    complaintHelpFair: "No decision without a stated reason",
    previewHeading: "Your complaint at a glance",
    previewReason: "Reason",
    previewMode: "Mode",
    previewCase: "Case",
    previewContact: "Contact",
    previewDate: "Incident date",
    previewAnonymous: "Anonymous",
    previewWhoSees: "Who will see this",
    previewAnonymousYes: "Yes",
    previewAnonymousNo: "No",

    /* 5-step wizard — en */
    stepLabel: "Step",
    stepOf: "5",
    progress1: "Identity",
    progress2: "For",
    progress3: "Problem",
    progress4: "Time",
    progress5: "Consent",
    s1Headline: "Tell us your name",
    s1Sub:
      "Press the microphone and say your name, or type it in the box below.",
    s2Headline: "Step 2 • Who are you applying for?",
    s2Question: "Who are you applying on behalf of?",
    s2Sub:
      "You can apply for yourself, or as a proxy for a vulnerable family member.",
    s3Headline: "Step 3 • Type of dispute",
    s3Question: "Choose the type of problem",
    s3Sub: "Pick the main problem from the cards below",
    s4Headline: "Step 4 • When is it safe to talk?",
    s4Sub:
      "Pick a time when no one else is around and the risk of trouble is low.",
    s4Promise:
      "Special promise: we will only contact you at this exact time. No calls or SMS will be sent outside of it without your permission.",
    s5Headline: "Step 5 • Final consent",
    s5Sub: "Proxy and legal-aid consent",
    s5Confirm:
      "For legal protection, please provide a voice recording or typed consent.",
    nameLabel: "Your name (type it or use the microphone below)",
    namePlaceholder: "Type your name here…",
    phoneLabel: "Your mobile number (for SMS or calls)",
    phonePlaceholder: "01XXXXXXXXX",
    proxyRelLabel: "Relationship",
    proxyRelPlaceholder: "e.g. Sister",
    proxyNameLabel: "Their name (the affected person)",
    proxyNamePlaceholder: "Type the affected person's name",
    proxyPhoneLabel: "Their phone number (optional - only if separate)",
    proxyPhonePlaceholder: "Enter phone number",
    proxySafety:
      "For safety reasons, you can leave this blank if calling them would be risky.",
    voiceIdle: "Tap to speak",
    voiceListening: "Listening…",
    voiceProcessing: "Thinking…",
    voiceDone: "Saved",
    voiceMicName: "Say your name",
    voiceMicPhone: "Say your mobile number",
    voiceMicDescription: "Record by voice",
    voiceMicConsent: "Give consent by voice",
    voiceSavedHint: "Saved",
    actingSelfTitle: "For myself",
    actingSelfSub: "I am the affected person",
    actingFamilyTitle: "For a family member",
    actingFamilySub: "Sister, mother, brother or relative",
    actingNeighborTitle: "For a neighbour or friend",
    actingNeighborSub: "As an emergency helper",
    dispute1Title: "Family violence",
    dispute1Sub: "Physical or mental abuse",
    dispute1Eyebrow: "Urgent priority",
    dispute2Title: "Maintenance stopped",
    dispute2Sub: "No regular support for spouse or children",
    dispute2Eyebrow: "General salish",
    dispute3Title: "Dowry demand",
    dispute3Sub: "Pressure for money or goods",
    dispute3Eyebrow: "Legal supervision",
    dispute4Title: "Land / property dispute",
    dispute4Sub: "Boundary, partition or possession",
    dispute4Eyebrow: "Document review",
    dispute5Title: "Child custody",
    dispute5Sub: "Care and rights of a child",
    dispute5Eyebrow: "Child protection",
    dispute6Title: "Other disputes",
    dispute6Sub: "Loans or other debts",
    dispute6Eyebrow: "Special review",
    slot1Title: "Friday morning 10–10:30",
    slot1Sub: "Quiet weekend atmosphere",
    slot2Title: "While husband is at work",
    slot2Sub: "Between 11 AM and 2 PM",
    slot3Title: "Evening 7–8 PM",
    slot3Sub: "After the day's work",
    slot4Title: "Anytime",
    slot4Sub: "Any working day, urgent or routine",
    consentStep1Title: "Method 1: press the microphone and say",
    consentStep1VoiceLabel: "“I give my full consent for this application”",
    consentStep2Title:
      "Method 2: or type your consent directly to confirm",
    consentPhrase: "I give my full consent for this application",
    consentConfirmBtn: "Confirm consent",
    consentLegal:
      "Under the National Legal Aid Act, third-party conciliation efforts are validated through recorded consent.",
    reviewHeading: "Application summary",
    reviewApplicant: "Applicant",
    reviewPhone: "Contact",
    reviewDispute: "Problem",
    reviewContact: "Safe contact time",
    reviewOfficeName: "Joypurhat District Legal Aid Centre",
    backBtn: "Back",
    nextBtn: "Next step",
    submitBtn: "Submit application",
    applyAgainBtn: "Start another application",
    previewEmpty:
      "Once you fill in your details, a short summary will appear here.",
    previewApplicant: "Applicant",
    previewDispute: "Problem",
    previewActingFor: "Applying for",
    previewContactSlot: "Safe contact time",
    previewConsent: "Consent",
    help1Title: "Tell us",
    help1Body: "Write your problem in plain language, or speak it.",
    help2Title: "Pick a safe time",
    help2Body: "We will try to reach you when it is convenient.",
    help3Title: "No decision without reason",
    help3Body: "Your words and evidence are checked before any step is taken.",
    successTitle: "Application received",
    successBody:
      "Your application has been recorded. We will contact you at the time you chose.",
    successNext1: "We will respond within 5 working days.",
    successNext2: "No contact will be made outside your chosen time.",
    successNext3: "Every step of the application is logged.",
    descLabel: "Extra details about the problem (speak or type)",
    descPlaceholder: "Type here directly…",
    descVoiceNoteAdded: "Voice note attached (0:28 sec)",
    specialInstrLabel: "Any special instructions (optional)",
    specialInstrPlaceholder: "e.g. only message me on WhatsApp…",
    errName: "Please type your name.",
    errPhone: "Please provide a mobile number for contact.",
    errActingFor: "Please pick one option.",
    errProxyName: "Type the affected person's name.",
    errProxyRel: "Pick a relationship.",
    errDispute: "Please choose a problem type.",
    errContactSlot: "Pick a safe contact time.",
    errConsent: "Please give consent to submit the application.",

    /* case-detail — en */
    caseBackToMyCases: "← Back to my cases",
    caseHeaderEyebrow: "Government online dispute resolution",
    caseHeaderTitle: "Your case status",
    caseApplicant: "Applicant",
    caseBeneficiary: "On behalf of",
    caseIssue: "Issue",
    caseIdLabel: "Case ID",
    caseIdOffice: "Office",
    caseCopyLabel: "Copy",
    caseCopiedLabel: "Copied",
    caseStatusLabel: "Current status",
    statusSubmitted: "Submitted",
    statusUnderReview: "Under review",
    statusApproved: "Approved",
    statusMediationStarted: "Mediation started",
    statusAgreementPending: "Agreement pending",
    statusResolved: "Resolved",
    statusClosed: "Closed",
    statusInProgress: "In progress",
    statusUpcoming: "Upcoming",
    nextActionHeading: "Next action",
    nextActionSubmittedTitle: "Application submitted",
    nextActionSubmittedBody:
      "Your application has been received. An officer will review your information in the next step.",
    nextActionUnderReviewTitle: "Your application is being reviewed",
    nextActionUnderReviewBody:
      "An officer is verifying the information you provided.",
    nextActionMediationTitle:
      "The mediator will contact you shortly",
    nextActionMediationBody:
      "A call is expected on Friday morning between 10–10:30. Please be ready: you will have 15 minutes to talk.",
    nextActionMediationHint:
      "You will receive a notification on your phone shortly before the scheduled time.",
    nextActionConfirmTime: "Confirm safe contact time",
    nextActionAgreementTitle: "Review the agreement",
    nextActionAgreementBody:
      "The outcome of mediation is awaiting your approval.",
    nextActionResolvedTitle: "Your case has been resolved",
    nextActionResolvedBody:
      "Your case has been completed successfully.",
    nextActionResolvedHint:
      "You can still download the draft agreement if you need to.",
    timelineHeading: "Current progress",
    timelineCompleted: "Completed",
    timelineCurrent: "In progress",
    timelineUpcoming: "Upcoming",
    timelineNext: "Next step",
    actionHeading: "Urgent actions and contact",
    actionAudioUpdate: "Listen to audio update",
    actionAudioUnavailable: "Audio not available in this prototype yet",
    actionAudioUnavailableHint:
      "In production, a recorded update will play here.",
    actionViewAgreement: "View and download agreement draft",
    actionAgreementPending: "Agreement draft not yet ready",
    actionFindUdc: "Find nearest UDC",
    mediatorHeading: "About your mediator",
    mediatorName: "Name",
    mediatorDesignation: "Designation",
    mediatorArea: "Area",
    mediatorContactTime: "Approved contact time",
    mediatorNotAssigned:
      "A mediator has not been assigned yet.",
    communicationHeading: "Conversation highlights",
    communicationLatestFrom: "Latest reply",
    communicationOpenThread: "See full message thread",
    communicationClose: "Close",
    communicationEmpty: "No messages yet.",
    communicationYou: "You",
    communicationMediator: "Mediator",
    documentsHeading: "Case documents",
    documentsEmpty: "No documents attached yet.",
    docApplication: "Application form",
    docVoiceStatement: "Voice statement",
    docIdProof: "Identity document",
    docAgreementDraft: "Agreement draft",
    docStatusFiled: "Filed",
    docStatusVerified: "Verified",
    docStatusPending: "Pending",
    docViewLabel: "View",
    docDownloadLabel: "Download",
    caseInfoHeading: "Case information",
    caseInfoApplicant: "Applicant",
    caseInfoBeneficiary: "On behalf of",
    caseInfoIssue: "Issue type",
    caseInfoSubmittedAt: "Submitted on",
    caseInfoSafeTime: "Safe contact time",
    caseInfoOffice: "Office",
    safetyHeading: "Your data is protected",
    safetyBody:
      "Your information will only be used for the necessary steps of this case. No contact will be made outside the safe time you chose.",
    caseNotFoundHeading: "This case is not ready yet",
    caseNotFoundBody: "Please try again later.",
    errorCopyFailed: "Could not copy.",
    /* --- citizen sidebar + dashboard redesign --- */
    navHome: "Home",
    navNotifications: "Notifications",
    navMyUdcOffice: "My UDC office",
    navLegalAidOfficer: "Legal aid officer",
    navContactSupport: "Contact support",
    sidebarSectionMain: "Main",
    sidebarSectionMyCases: "My cases",
    sidebarSectionUdc: "UDC office",
    homeGreetingMorning: "Good morning",
    homeGreetingAfternoon: "Good afternoon",
    homeGreetingEvening: "Good evening",
    homeHowCanWeHelp: "How can we help you today?",
    homeActionLodgeTitle: "Lodge a complaint",
    homeActionLodgeDesc: "Tell us what happened — by voice or by typing.",
    homeActionMyCasesTitle: "My cases",
    homeActionMyCasesDesc: "Continue with your active cases and updates.",
    homeActionUdcTitle: "UDC office",
    homeActionUdcDesc: "Find your nearest legal aid centre and officer.",
    homeActionStart: "Start now",
    homeActionView: "View my cases",
    homeActionFind: "Find UDC",
    homeRecentCases: "Recent cases",
    homeViewCase: "View case",
    homeNoRecentCases: "You haven't filed any complaints yet.",
    homeUpdatedOn: "Updated",
    notificationListHeading: "Notifications",
    notificationMarkAllRead: "Mark all as read",
    notificationAllCaughtUp: "You're all caught up",
    notificationAllCaughtUpSub: "You've seen every notification.",
    notification1Title: "Application received",
    notification1Body: "Your application is being reviewed by an officer.",
    notification1Time: "2 hours ago",
    notification2Title: "Mediator replied",
    notification2Body: "“We have received your statement and documents.”",
    notification2Time: "18 September, 4:20 PM",
    notification3Title: "National ID verified",
    notification3Body: "Your national ID has been verified successfully.",
    notification3Time: "17 September",
    notification4Title: "Agreement draft ready",
    notification4Body: "Your mediator has prepared a draft agreement.",
    notification4Time: "14 September",
    notification5Title: "Profile incomplete",
    notification5Body: "Add a safe contact time so we can reach you.",
    notification5Time: "12 September",
    notificationReadBadge: "Read",
    notificationUnreadBadge: "New",
    statusActive: "Active",
    statusNeedsAction: "Needs action",
    profileSettings: "Settings",
    profileLogout: "Log out",
    profileComingSoon: "Coming soon",
    bottomNavHome: "Home",
    bottomNavLodge: "Lodge",
    bottomNavCases: "Cases",
    bottomNavUdc: "UDC",
    udcMyOfficeTitle: "My UDC office",
    udcMyOfficeBody:
      "Address, visiting hours, and intake rules for the district legal aid centre in your area.",
    udcOfficerTitle: "Legal aid officer",
    udcOfficerBody:
      "Your assigned officer reviews your application and selects a panel mediator when needed.",
    udcContactTitle: "Contact support",
    udcContactBody:
      "Call 16699 or message us through the app if you can't visit the office in person.",
    udcTabOverview: "Overview",
    udcTabOffice: "Office",
    udcTabOfficer: "Officer",
    udcTabContact: "Contact",
    udcComingSoonBody: "This section will be added in a later update.",
    notifBadgeLabel: "New",
    homeIssueLabel: "Issue",
    /* --- UDC section mock content --- */
    udcOverviewEyebrow: "Overview",
    udcOverviewHeadline: "Your UDC office at a glance",
    udcOverviewIntro:
      "A quick snapshot of your district legal aid centre, the assigned officer, and the cases in motion.",
    udcKpiOffice: "Active offices",
    udcKpiOfficer: "Officers on duty",
    udcKpiOpenCases: "Open cases",
    udcKpiAvgResponse: "Avg. first response",
    udcStatusHeading: "Office service status",
    udcStatusOpen: "Open today",
    udcStatusClosed: "Closed today",
    udcStatusNote: "Weekly off: Friday. Emergency hotline is open 24/7.",
    udcOfficeNameLabel: "Office name",
    udcOfficeAddressLabel: "Address",
    udcOfficeAddressLine1: "Joypurhat District Legal Aid Centre",
    udcOfficeAddressLine2: "Old Court Building, 2nd floor, Panchbibi, Joypurhat",
    udcOfficePhoneLabel: "Phone",
    udcOfficeEmailLabel: "Email",
    udcOfficeHoursHeading: "Opening hours",
    udcOfficeHoursSun: "Sunday",
    udcOfficeHoursSunClosed: "Closed",
    udcOfficeHoursMon: "Monday",
    udcOfficeHoursTue: "Tuesday",
    udcOfficeHoursWed: "Wednesday",
    udcOfficeHoursThu: "Thursday",
    udcOfficeHoursFri: "Friday",
    udcOfficeHoursSat: "Saturday",
    udcOfficeHoursSatClosed: "Closed",
    udcIntakeHeading: "Intake process",
    udcIntakeStep1: "Identity check",
    udcIntakeStep1Body:
      "Visit the centre with your national ID or birth registration certificate.",
    udcIntakeStep2: "Initial interview",
    udcIntakeStep2Body:
      "An officer listens to your situation and confirms eligibility (20–30 minutes).",
    udcIntakeStep3: "Document intake",
    udcIntakeStep3Body:
      "Required papers are collected and a voice statement is recorded.",
    udcIntakeStep4: "Mediator assignment",
    udcIntakeStep4Body:
      "If eligible, a panel mediator is assigned within 48 hours.",
    udcOfficerNameLabel: "Officer name",
    udcOfficerName: "Md. Anwar Hossain",
    udcOfficerDesignation: "District Legal Aid Officer (DLASO)",
    udcOfficerArea: "Assigned area",
    udcOfficerAreaValue: "Joypurhat Sadar & Panchbibi upazila",
    udcOfficerContactTime: "Safe contact time",
    udcOfficerContactTimeValue: "Sunday–Thursday, 3:00–5:00 PM",
    udcOfficerAssignedCases: "Assigned cases",
    udcOfficerCasesCount: "18 total · 6 in progress",
    udcOfficerExperience: "Experience",
    udcOfficerExperienceValue: "8 years · 240+ cases",
    udcServicesHeading: "Services handled by your officer",
    udcService1Title: "Eligibility review",
    udcService1Body:
      "Verifies financial and social eligibility and recommends legal aid.",
    udcService2Title: "Mediator assignment",
    udcService2Body:
      "Selects and assigns the panel mediator based on the nature of the case.",
    udcService3Title: "Hearing coordination",
    udcService3Body:
      "Coordinates hearing dates and times between the citizen, lawyer, and court.",
    udcService4Title: "Document verification & storage",
    udcService4Body:
      "Digitally verifies and stores national ID, voice statements, and draft agreements.",
    udcContactHeading: "Reach our office",
    udcContactHotlineTitle: "National hotline",
    udcContactHotlineBody: "16699 — toll-free from anywhere in Bangladesh",
    udcContactHotlineNote: "Open 24/7 · Bangla & English",
    udcContactInAppTitle: "Through the app",
    udcContactInAppBody:
      "Send a direct message to your officer from a notification or case page.",
    udcContactWalkInTitle: "Walk into the office",
    udcContactWalkInBody:
      "Visit in person during opening hours on any working day.",
    udcContactWalkInNote: "Don't forget to bring your ID card.",
    udcContactEmailTitle: "Email",
    udcContactEmailBody: "joypurhat.dlaso@example.gov.bd",
    udcContactPostalTitle: "Postal mail",
    udcContactPostalBody:
      "You may send written applications or complaints by post.",
    udcContactPostalAddress:
      "Office of the District Legal Aid Officer, Old Court Building, Joypurhat-5900",
    udcViewOnMap: "View on map",
  },
};

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY_READ = STORAGE_KEY;
const listeners = new Set<() => void>();

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "bn";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY_READ);
    return stored === "en" || stored === "bn" ? stored : "bn";
  } catch {
    return "bn";
  }
}

function subscribeToLang(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", onLangStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onLangStorage);
  };
}

function onLangStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY_READ) {
    listeners.forEach((listener) => listener());
  }
}

function persistLang(next: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY_READ, next);
  } catch {
    // storage unavailable — keep in-memory choice
  }
  listeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore<Lang>(
    subscribeToLang,
    readStoredLang,
    () => "bn",
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: persistLang,
      t: (key) => messages[lang][key],
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
