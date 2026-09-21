"use client";

import { useI18n, type Lang, type MessageKey } from "@/lib/i18n";
import { useHashRoute } from "@/lib/use-hash-route";
import {
  Briefcase,
  Building,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  Shield,
  User,
} from "@/components/icons";
import styles from "./udc-section.module.css";

/* ------------------------------------------------------------------ *
 *  UdcSection — rich mock content for the 4 sub-tabs under
 *  `#udc`. Driven entirely from the URL hash; tab state is
 *  maintained by `role-dashboard.tsx` (which passes `tab` in).
 *
 *  Tabs:
 *    overview → KPI strip + service status strip + contact preview
 *    office   → Office profile + hours table + intake steps
 *    officer  → Officer card + assigned cases + services list
 *    contact  → 4 channels (hotline / in-app / walk-in / email / post)
 * ------------------------------------------------------------------ */

export type UdcTab = "overview" | "office" | "officer" | "contact";

const TAB_LABELS: Record<UdcTab, MessageKey> = {
  overview: "udcTabOverview",
  office: "udcTabOffice",
  officer: "udcOfficerTitle",
  contact: "udcContactTitle",
};

const TAB_ORDER: UdcTab[] = ["overview", "office", "officer", "contact"];

export function UdcSection({ lang, tab }: { lang: Lang; tab: UdcTab }) {
  const { t } = useI18n();
  const { navigate } = useHashRoute();

  function go(next: UdcTab) {
    navigate(next === "overview" ? "#udc" : `#udc/${next}`);
  }

  return (
    <section
      id="udc"
      role="region"
      aria-label={lang === "bn" ? "ইউডিসি অফিস" : "UDC office"}
      className={styles.section}
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t("sidebarSectionUdc")}</p>
        <h1 className={styles.headline}>
          {lang === "bn"
            ? "আপনার আইনি সহায়তা কেন্দ্র"
            : "Your legal aid centre"}
        </h1>
        <p className={styles.intro}>
          {lang === "bn"
            ? "আপনার এলাকার জেলা আইনি সহায়তা কেন্দ্র, কর্মকর্তা ও যোগাযোগের তথ্য।"
            : "Find your district legal aid centre, the officer assigned to your area, and how to reach us."}
        </p>
      </header>

      <nav className={styles.tabs} aria-label={lang === "bn" ? "বিভাগ" : "Sections"}>
        {TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`}
            onClick={() => go(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            {t(TAB_LABELS[id])}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {tab === "overview" ? <OverviewPane lang={lang} /> : null}
        {tab === "office" ? <OfficePane /> : null}
        {tab === "officer" ? <OfficerPane /> : null}
        {tab === "contact" ? <ContactPane lang={lang} /> : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 *  Overview — KPI strip + service status + a short contact preview.
 * ------------------------------------------------------------------ */

function OverviewPane({ lang }: { lang: Lang }) {
  const { t } = useI18n();
  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <p className={styles.paneEyebrow}>{t("udcOverviewEyebrow")}</p>
        <h2 className={styles.paneTitle}>{t("udcOverviewHeadline")}</h2>
        <p className={styles.paneIntro}>{t("udcOverviewIntro")}</p>
      </div>

      <div className={styles.kpis}>
        <Kpi label={t("udcKpiOffice")} value="01" sub={lang === "bn" ? "জয়পুরহাট" : "Joypurhat"} />
        <Kpi label={t("udcKpiOfficer")} value="02" sub={lang === "bn" ? "১ নিয়োজিত" : "1 assigned to you"} />
        <Kpi label={t("udcKpiOpenCases")} value="06" sub={lang === "bn" ? "আপনার এলাকায়" : "in your area"} />
        <Kpi label={t("udcKpiAvgResponse")} value="06h" sub={lang === "bn" ? "গড় প্রথম পদক্ষেপ" : "median first action"} />
      </div>

      <div className={styles.statusStrip}>
        <div className={styles.statusBadge}>
          <span className={styles.statusDot} aria-hidden />
          <span>
            {t("udcStatusHeading")} ·{" "}
            <strong>{hourNow() < 17 ? t("udcStatusOpen") : t("udcStatusClosed")}</strong>
          </span>
        </div>
        <p className={styles.statusNote}>{t("udcStatusNote")}</p>
      </div>

      <div className={styles.previewGrid}>
        <PreviewCard
          icon={<Building size={20} />}
          title={t("udcOfficeNameLabel")}
          body="জয়পুরহাট জেলা আইনি সহায়তা কেন্দ্র"
          cta={{ label: t("udcViewOnMap"), href: "#udc/office" }}
        />
        <PreviewCard
          icon={<User size={20} />}
          title={t("udcOfficerName")}
          body={t("udcOfficerDesignation")}
          cta={{ label: t("udcViewOnMap"), href: "#udc/officer" }}
        />
        <PreviewCard
          icon={<Phone size={20} />}
          title={t("udcContactHotlineTitle")}
          body={t("udcContactHotlineBody")}
          cta={{ label: t("udcViewOnMap"), href: "#udc/contact" }}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiSub}>{sub}</span>
    </div>
  );
}

function PreviewCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  return (
    <article className={styles.previewCard}>
      <span className={styles.previewIcon} aria-hidden>
        {icon}
      </span>
      <span className={styles.previewTitle}>{title}</span>
      <span className={styles.previewBody}>{body}</span>
      <a className={styles.previewCta} href={cta.href}>
        {cta.label} →
      </a>
    </article>
  );
}

function hourNow(): number {
  return new Date().getHours();
}

/* ------------------------------------------------------------------ *
 *  Office — full office profile with hours table and intake steps.
 * ------------------------------------------------------------------ */

function OfficePane() {
  const { t } = useI18n();
  return (
    <div className={styles.pane}>
      <div className={styles.officeGrid}>
        <article className={styles.officeCard}>
          <h3 className={styles.cardTitle}>{t("udcOfficeHeading")}</h3>
          <dl className={styles.metaList}>
            <div className={styles.metaRow}>
              <dt>
                <Building size={16} aria-hidden /> {t("udcOfficeNameLabel")}
              </dt>
              <dd>{t("udcOfficeAddressLine1")}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt>
                <MapPin size={16} aria-hidden /> {t("udcOfficeAddressLabel")}
              </dt>
              <dd>
                {t("udcOfficeAddressLine1")}
                <br />
                {t("udcOfficeAddressLine2")}
              </dd>
            </div>
            <div className={styles.metaRow}>
              <dt>
                <Phone size={16} aria-hidden /> {t("udcOfficePhoneLabel")}
              </dt>
              <dd>
                <a href="tel:+8801700000000" className={styles.link}>
                  +880 1700-000000
                </a>
                <span className={styles.metaHint}> · 02-XXXXXXX</span>
              </dd>
            </div>
            <div className={styles.metaRow}>
              <dt>
                <Mail size={16} aria-hidden /> {t("udcOfficeEmailLabel")}
              </dt>
              <dd>
                <a href={`mailto:${t("udcContactEmailBody")}`} className={styles.link}>
                  {t("udcContactEmailBody")}
                </a>
              </dd>
            </div>
          </dl>
        </article>

        <article className={styles.hoursCard}>
          <h3 className={styles.cardTitle}>{t("udcOfficeHoursHeading")}</h3>
          <table className={styles.hoursTable}>
            <tbody>
              <HoursRow dayKey="udcOfficeHoursSun" closed />
              <HoursRow dayKey="udcOfficeHoursMon" hours="09:00 – 17:00" />
              <HoursRow dayKey="udcOfficeHoursTue" hours="09:00 – 17:00" />
              <HoursRow dayKey="udcOfficeHoursWed" hours="09:00 – 17:00" />
              <HoursRow dayKey="udcOfficeHoursThu" hours="09:00 – 17:00" />
              <HoursRow dayKey="udcOfficeHoursFri" closed />
              <HoursRow dayKey="udcOfficeHoursSat" closed />
            </tbody>
          </table>
        </article>
      </div>

      <article className={styles.intakeCard}>
        <h3 className={styles.cardTitle}>
          <Briefcase size={18} aria-hidden /> {t("udcIntakeHeading")}
        </h3>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <span>
              <strong>{t("udcIntakeStep1")}</strong>
              <span className={styles.stepBody}>{t("udcIntakeStep1Body")}</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <span>
              <strong>{t("udcIntakeStep2")}</strong>
              <span className={styles.stepBody}>{t("udcIntakeStep2Body")}</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <span>
              <strong>{t("udcIntakeStep3")}</strong>
              <span className={styles.stepBody}>{t("udcIntakeStep3Body")}</span>
            </span>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNum}>4</span>
            <span>
              <strong>{t("udcIntakeStep4")}</strong>
              <span className={styles.stepBody}>{t("udcIntakeStep4Body")}</span>
            </span>
          </li>
        </ol>
      </article>
    </div>
  );
}

function HoursRow({
  dayKey,
  hours,
  closed,
}: {
  dayKey: MessageKey;
  hours?: string;
  closed?: boolean;
}) {
  const { t } = useI18n();
  return (
    <tr className={closed ? styles.hoursClosed : ""}>
      <th scope="row">{t(dayKey)}</th>
      <td>{closed ? t("udcOfficeHoursSunClosed") : hours}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------ *
 *  Officer — officer card, stats, services list.
 * ------------------------------------------------------------------ */

function OfficerPane() {
  const { t } = useI18n();
  return (
    <div className={styles.pane}>
      <article className={styles.officerCard}>
        <div className={styles.officerAvatar} aria-hidden>
          <User size={36} />
        </div>
        <div className={styles.officerInfo}>
          <p className={styles.officerEyebrow}>{t("udcOfficerNameLabel")}</p>
          <h3 className={styles.officerName}>{t("udcOfficerName")}</h3>
          <p className={styles.officerDesignation}>
            <Scale size={14} aria-hidden /> {t("udcOfficerDesignation")}
          </p>
        </div>
      </article>

      <dl className={styles.statsGrid}>
        <div className={styles.statRow}>
          <dt>
            <MapPin size={14} aria-hidden /> {t("udcOfficerArea")}
          </dt>
          <dd>{t("udcOfficerAreaValue")}</dd>
        </div>
        <div className={styles.statRow}>
          <dt>
            <Phone size={14} aria-hidden /> {t("udcOfficerContactTime")}
          </dt>
          <dd>{t("udcOfficerContactTimeValue")}</dd>
        </div>
        <div className={styles.statRow}>
          <dt>
            <Briefcase size={14} aria-hidden /> {t("udcOfficerAssignedCases")}
          </dt>
          <dd>{t("udcOfficerCasesCount")}</dd>
        </div>
        <div className={styles.statRow}>
          <dt>
            <Shield size={14} aria-hidden /> {t("udcOfficerExperience")}
          </dt>
          <dd>{t("udcOfficerExperienceValue")}</dd>
        </div>
      </dl>

      <article className={styles.servicesCard}>
        <h3 className={styles.cardTitle}>{t("udcServicesHeading")}</h3>
        <div className={styles.servicesGrid}>
          <ServiceItem
            icon={<Shield size={18} />}
            title={t("udcService1Title")}
            body={t("udcService1Body")}
          />
          <ServiceItem
            icon={<Scale size={18} />}
            title={t("udcService2Title")}
            body={t("udcService2Body")}
          />
          <ServiceItem
            icon={<Briefcase size={18} />}
            title={t("udcService3Title")}
            body={t("udcService3Body")}
          />
          <ServiceItem
            icon={<Shield size={18} />}
            title={t("udcService4Title")}
            body={t("udcService4Body")}
          />
        </div>
      </article>
    </div>
  );
}

function ServiceItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className={styles.serviceItem}>
      <span className={styles.serviceIcon} aria-hidden>{icon}</span>
      <span className={styles.serviceTitle}>{title}</span>
      <span className={styles.serviceBody}>{body}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Contact — 5 channels laid out as cards.
 * ------------------------------------------------------------------ */

function ContactPane({ lang }: { lang: Lang }) {
  const { t } = useI18n();
  return (
    <div className={styles.pane}>
      <div className={styles.contactHeader}>
        <p className={styles.paneEyebrow}>{t("udcContactHeading")}</p>
        <h2 className={styles.paneTitle}>
          {lang === "bn"
            ? "যেকোনো প্রশ্নে আমরা আছি পাশে"
            : "We're here for any question you have"}
        </h2>
      </div>
      <div className={styles.contactGrid}>
        <ContactCard
          icon={<Phone size={22} />}
          title={t("udcContactHotlineTitle")}
          body={t("udcContactHotlineBody")}
          note={t("udcContactHotlineNote")}
          action={{
            label: "16699",
            href: "tel:16699",
          }}
        />
        <ContactCard
          icon={<MessageCircle size={22} />}
          title={t("udcContactInAppTitle")}
          body={t("udcContactInAppBody")}
        />
        <ContactCard
          icon={<MapPin size={22} />}
          title={t("udcContactWalkInTitle")}
          body={t("udcContactWalkInBody")}
          note={t("udcContactWalkInNote")}
          action={{
            label: t("udcViewOnMap"),
            href: "#udc/office",
          }}
        />
        <ContactCard
          icon={<Mail size={22} />}
          title={t("udcContactEmailTitle")}
          body={t("udcContactEmailBody")}
          action={{
            label: lang === "bn" ? "ইমেইল পাঠান" : "Send email",
            href: `mailto:${t("udcContactEmailBody")}`,
          }}
        />
        <ContactCard
          icon={<Briefcase size={22} />}
          title={t("udcContactPostalTitle")}
          body={t("udcContactPostalBody")}
          note={t("udcContactPostalAddress")}
        />
      </div>
    </div>
  );
}

function ContactCard({
  icon,
  title,
  body,
  note,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  note?: string;
  action?: { label: string; href: string };
}) {
  return (
    <article className={styles.contactCard}>
      <span className={styles.contactIcon} aria-hidden>{icon}</span>
      <span className={styles.contactTitle}>{title}</span>
      <span className={styles.contactBody}>{body}</span>
      {note ? <span className={styles.contactNote}>{note}</span> : null}
      {action ? (
        <a className={styles.contactAction} href={action.href}>
          {action.label} →
        </a>
      ) : null}
    </article>
  );
}