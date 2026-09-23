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

  function markAllRead() {
    if (me) CitizenAuth.markNotificationsRead(me.citizenId);
  }

  return (
    <section className={styles.section} aria-label={t("notificationListHeading")}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{t("notificationListHeading")}</h1>
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
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`${styles.row} ${item.unread ? styles.rowUnread : ""}`}
                onClick={() => {
                  // Opening a notification counts as seeing the feed — the glow stops.
                  if (me && item.unread) CitizenAuth.markNotificationsRead(me.citizenId);
                  navigate(item.href);
                }}
              >
                <span
                  className={`${styles.unreadDot} ${item.unread ? styles.unreadDotOn : ""}`}
                  aria-hidden
                />
                <span className={styles.iconWrap} aria-hidden>
                  <NotificationIcon name={item.icon} />
                </span>
                <span className={styles.body}>
                  <span className={styles.title}>{item.title[lang]}</span>
                  <span className={styles.sub}>{item.body[lang]}</span>
                  <span className={styles.time}>
                    {new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.at))}
                  </span>
                </span>
                {item.unread ? (
                  <span className={styles.badge}>{t("notificationUnreadBadge")}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
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