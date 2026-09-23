"use client";

import { useI18n } from "@/lib/i18n";
import { CitizenAuth } from "@/lib/dlas";
import { useCitizenNotifications, useCurrentCitizen, type CitizenNotification } from "@/lib/dlas/citizen-view";
import { useHashRoute } from "@/lib/use-hash-route";
import { Bell, Check, Shield, User } from "@/components/icons";
import styles from "./notification-list.module.css";

/* ------------------------------------------------------------------ *
 *  NotificationList — built from the logged-in citizen's own records
 *  in dlas.db.v1 (applications, open tasks, simulated SMS).
 *  "Mark all as read" is stored on the account, so it survives reload.
 * ------------------------------------------------------------------ */

export function NotificationList() {
  const { t, lang } = useI18n();
  const { navigate } = useHashRoute();
  const me = useCurrentCitizen();
  const items = useCitizenNotifications();
  const allRead = items.every((i) => !i.unread);
  const unreadCount = items.filter((i) => i.unread).length;
  const dateFormatter = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const groups = [
    { key: "new", title: lang === "bn" ? "নতুন" : "New", items: items.filter((i) => i.unread) },
    { key: "earlier", title: lang === "bn" ? "আগের বিজ্ঞপ্তি" : "Earlier", items: items.filter((i) => !i.unread) },
  ];

  function markAllRead() {
    if (me) CitizenAuth.markNotificationsRead(me.citizenId);
  }

  return (
    <section className={styles.section} aria-label={t("notificationListHeading")}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{lang === "bn" ? "আপনার খবর" : "YOUR UPDATES"}</p>
          <h1 className={styles.heading}>{t("notificationListHeading")}</h1>
          <p className={styles.summary} aria-live="polite">
            {unreadCount > 0
              ? (lang === "bn" ? `${unreadCount}টি নতুন বিজ্ঞপ্তি` : `${unreadCount} new ${unreadCount === 1 ? "notification" : "notifications"}`)
              : (lang === "bn" ? "সব বিজ্ঞপ্তি পড়া হয়েছে" : "All notifications read")}
          </p>
        </div>
        <button
          type="button"
          className={styles.markAllBtn}
          onClick={markAllRead}
          disabled={allRead}
        >
          {t("notificationMarkAllRead")}
        </button>
      </header>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden>
            <Check size={28} />
          </div>
          <p className={styles.emptyTitle}>{t("notificationAllCaughtUp")}</p>
          <p className={styles.emptySub}>{t("notificationAllCaughtUpSub")}</p>
        </div>
      ) : (
        groups.filter((group) => group.items.length > 0).map((group) => (
          <div className={styles.group} key={group.key}>
            <h2 className={styles.groupHeading}>{group.title}<span>{group.items.length}</span></h2>
            <ul className={styles.list}>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${item.unread ? styles.rowUnread : ""}`}
                    onClick={() => {
                      if (me && item.unread) CitizenAuth.markNotificationsRead(me.citizenId);
                      navigate(item.href);
                    }}
                  >
                    <span className={styles.iconWrap} aria-hidden><NotificationIcon name={item.icon} /></span>
                    <span className={styles.body}>
                      <span className={styles.titleLine}>
                        <span className={styles.title}>{item.title[lang]}</span>
                        {item.unread ? <span className={styles.badge}>{t("notificationUnreadBadge")}</span> : null}
                      </span>
                      <span className={styles.sub}>{item.body[lang]}</span>
                      <span className={styles.meta}>
                        <time dateTime={item.at}>{dateFormatter.format(new Date(item.at))}</time>
                        <span className={styles.openCue}>{lang === "bn" ? "বিস্তারিত দেখুন" : "View details"} <span aria-hidden="true">→</span></span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function NotificationIcon({ name }: { name: CitizenNotification["icon"] }) {
  switch (name) {
    case "shield": return <Shield size={20} />;
    case "user": return <User size={20} />;
    case "check": return <Check size={20} />;
    case "bell": return <Bell size={20} />;
  }
}
