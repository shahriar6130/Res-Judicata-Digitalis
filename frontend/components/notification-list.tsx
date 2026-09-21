"use client";

import { useMemo, useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useHashRoute } from "@/lib/use-hash-route";
import { Bell, Check, Shield, User } from "@/components/icons";
import styles from "./notification-list.module.css";

/* ------------------------------------------------------------------ *
 *  NotificationList — fully mocked for the prototype.
 *  Five realistic entries (mediator reply, hearing reminder, doc
 *  verified, agreement ready, profile incomplete). Read state is
 *  component-local so a refresh resets the demo. "Mark all as read"
 *  clears the unread dots.
 * ------------------------------------------------------------------ */

type NotificationItem = {
  id: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  timeKey: MessageKey;
  icon: "shield" | "user" | "check" | "bell";
  href: string;
  /** Defaults to unread for the first N entries. */
  defaultUnread: boolean;
};

const MOCK_ITEMS: NotificationItem[] = [
  { id: "n1", titleKey: "notification1Title", bodyKey: "notification1Body", timeKey: "notification1Time", icon: "shield", href: "cases", defaultUnread: true },
  { id: "n2", titleKey: "notification2Title", bodyKey: "notification2Body", timeKey: "notification2Time", icon: "user", href: "cases/SHK-DEMO-007", defaultUnread: true },
  { id: "n3", titleKey: "notification3Title", bodyKey: "notification3Body", timeKey: "notification3Time", icon: "check", href: "cases/SHK-DEMO-011", defaultUnread: false },
  { id: "n4", titleKey: "notification4Title", bodyKey: "notification4Body", timeKey: "notification4Time", icon: "check", href: "cases/SHK-DEMO-014", defaultUnread: false },
  { id: "n5", titleKey: "notification5Title", bodyKey: "notification5Body", timeKey: "notification5Time", icon: "bell", href: "home", defaultUnread: false },
];

export function NotificationList() {
  const { t } = useI18n();
  const { navigate } = useHashRoute();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  const items = useMemo(
    () =>
      MOCK_ITEMS.map((item) => ({
        ...item,
        isUnread: item.defaultUnread && !readIds.has(item.id),
      })),
    [readIds],
  );

  const allRead = items.every((i) => !i.isUnread);

  function markAllRead() {
    setReadIds(new Set(MOCK_ITEMS.map((i) => i.id)));
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

      {allRead ? (
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
                className={`${styles.row} ${item.isUnread ? styles.rowUnread : ""}`}
                onClick={() => navigate(item.href)}
              >
                <span
                  className={`${styles.unreadDot} ${item.isUnread ? styles.unreadDotOn : ""}`}
                  aria-hidden
                />
                <span className={styles.iconWrap} aria-hidden>
                  <NotificationIcon name={item.icon} />
                </span>
                <span className={styles.body}>
                  <span className={styles.title}>{t(item.titleKey)}</span>
                  <span className={styles.sub}>{t(item.bodyKey)}</span>
                  <span className={styles.time}>{t(item.timeKey)}</span>
                </span>
                {item.isUnread ? (
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

function NotificationIcon({ name }: { name: NotificationItem["icon"] }) {
  switch (name) {
    case "shield": return <Shield size={20} />;
    case "user": return <User size={20} />;
    case "check": return <Check size={20} />;
    case "bell": return <Bell size={20} />;
  }
}