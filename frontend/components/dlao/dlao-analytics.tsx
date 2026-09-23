"use client";

/* Hand-rolled SVG charts (no chart library) for the DLAO queue views. */

import { useMemo } from "react";
import {
  MATTERS,
  bucketOf,
  label,
  useOfficeQueue,
  type ApplicationRecord,
  type MatterCategory,
  type QueueBucket,
} from "@/lib/dlas";
import { useTx } from "../dlas/shared";
import styles from "./dlao-analytics.module.css";

type Slice = { key: string; label: string; count: number; color: string };

/* ------------ bucket composition (donut) ------------ */

const BUCKET_COLOR: Record<QueueBucket, string> = {
  NEW: "var(--status-pending)",
  IN_REVIEW: "var(--ink)",
  DECIDED: "var(--green)",
};

const BUCKET_LABEL: Record<QueueBucket, { bn: string; en: string }> = {
  NEW: { bn: "নতুন", en: "New" },
  IN_REVIEW: { bn: "যাচাই চলছে", en: "In verification" },
  DECIDED: { bn: "সিদ্ধান্ত", en: "Decided" },
};

function QueueDonut({ slices, total }: { slices: Slice[]; total: number }) {
  const { tx } = useTx();
  // Donut math: pick r=15.9155 so circumference rounds to 100, mapping
  // each segment's share straight onto a stroke-dasharray percentage.
  const r = 15.9155;
  const c = 100;
  // Running total → O(N) instead of O(N²).
  const segments: { key: string; color: string; dash: string; offset: number }[] = [];
  let acc = 0;
  for (const s of slices) {
    const len = (s.count / total) * c;
    segments.push({
      key: s.key,
      color: s.color,
      dash: `${len.toFixed(3)} ${(c - len).toFixed(3)}`,
      offset: acc,
    });
    acc += len;
  }
  return (
    <div className={styles.donutWrap}>
      <svg
        className={styles.donut}
        viewBox="0 0 42 42"
        role="img"
        aria-label={tx(`${total} টি আবেদন`, `${total} applications`)}
      >
        <circle className={styles.donutTrack} cx="21" cy="21" r={r} />
        {segments.map((seg) => (
          <circle
            key={seg.key}
            className={styles.donutSegment}
            cx="21"
            cy="21"
            r={r}
            stroke={seg.color}
            strokeDasharray={seg.dash}
            strokeDashoffset={-seg.offset}
          />
        ))}
      </svg>
      <div className={styles.donutCenter}>
        <span className={styles.donutTotal}>{total}</span>
        <span className={styles.donutCaption}>{tx("মোট আবেদন", "total cases")}</span>
      </div>
    </div>
  );
}

/* ------------ helpers for the bar charts ------------ */

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

function VerticalBars({ slices, total }: { slices: Slice[]; total: number }) {
  const max = slices.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  return (
    <ul className={styles.barsVertical}>
      {slices.map((s) => (
        <li key={s.key} className={styles.barCol} title={`${s.label} · ${s.count} (${pct(s.count, total)}%)`}>
          <span className={styles.barCount}>{s.count}</span>
          <span
            className={styles.barFill}
            style={{
              height: `${Math.max(6, Math.round((s.count / max) * 100))}%`,
              background: s.color,
            }}
          />
          <span className={styles.barLabel}>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function HorizontalBars({ slices, total }: { slices: Slice[]; total: number }) {
  const max = slices.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  return (
    <ul className={styles.barsHorizontal}>
      {slices.map((s) => (
        <li key={s.key} className={styles.barRow}>
          <span className={styles.barRowLabel}>{s.label}</span>
          <span className={styles.barRowTrack}>
            <span
              className={styles.barRowFill}
              style={{
                width: `${Math.max(4, Math.round((s.count / max) * 100))}%`,
                background: s.color,
              }}
            />
          </span>
          <span className={styles.barRowCount}>
            {s.count}
            <span className={styles.barRowPct}> · {pct(s.count, total)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------ legend ------------ */

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <dl className={styles.legend}>
      {slices.map((s) => (
        <div key={s.key} className={styles.legendRow}>
          <dt className={styles.legendLabel}>
            <span className={styles.legendSwatch} style={{ background: s.color }} aria-hidden />
            <span>{s.label}</span>
          </dt>
          <dd className={styles.legendValue}>
            {s.count}
            <span className={styles.legendPct}> · {pct(s.count, total)}%</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------ card chrome ------------ */

function AnalyticsCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {sub ? <p className={styles.cardSub}>{sub}</p> : null}
      </header>
      <div className={styles.cardBody}>{children}</div>
    </article>
  );
}

/* ------------ top-level ------------ */

export function OfficeAnalytics() {
  const { lang, tx } = useTx();
  const q = useOfficeQueue();

  const inScope = useMemo<ApplicationRecord[]>(
    () => [...q.NEW, ...q.IN_REVIEW, ...q.DECIDED],
    [q],
  );

  const dataset = useMemo(() => {
    const bucketCounts: Record<QueueBucket, number> = { NEW: 0, IN_REVIEW: 0, DECIDED: 0 };
    const matterCounts = new Map<MatterCategory | "UNKNOWN", number>();
    const channelCounts = new Map<string, number>();

    // Single pass over inScope: update all three counters at once.
    for (const a of inScope) {
      bucketCounts[bucketOf(a)] += 1;
      const m = (a.data.matter.category ?? "UNKNOWN") as MatterCategory | "UNKNOWN";
      matterCounts.set(m, (matterCounts.get(m) ?? 0) + 1);
      const c = a.channel.code || "UNKNOWN";
      channelCounts.set(c, (channelCounts.get(c) ?? 0) + 1);
    }

    const bucketSlices: Slice[] = (Object.keys(bucketCounts) as QueueBucket[])
      .map((k) => ({
        key: k,
        label: BUCKET_LABEL[k][lang],
        count: bucketCounts[k],
        color: BUCKET_COLOR[k],
      }))
      .filter((s) => s.count > 0);

    const MATTER_PALETTE = ["var(--ink)", "var(--status-pending)", "var(--green)", "var(--dlo-chart-purple)", "var(--dlo-chart-blue)", "var(--dlo-chart-rose)", "var(--dlo-chart-olive)"];
    const matterSlices: Slice[] = Array.from(matterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, count], i) => ({
        key: String(k),
        label: k === "UNKNOWN" ? tx("অজানা", "Unspecified") : label(MATTERS, k, lang),
        count,
        color: MATTER_PALETTE[i % MATTER_PALETTE.length],
      }));

    const CHANNEL_PALETTE: Record<string, string> = {
      WEB: "var(--ink)",
      UDC: "var(--status-pending)",
      UDC_ASSISTED: "var(--status-pending)",
      IVR: "var(--green)",
      USSD: "var(--dlo-chart-purple)",
      HELPLINE: "var(--dlo-chart-blue)",
      UNKNOWN: "var(--dlo-chart-muted)",
    };
    const channelSlices: Slice[] = Array.from(channelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, count]) => ({
        key: k,
        label: k === "UNKNOWN" ? tx("অজানা", "Unknown") : k,
        count,
        color: CHANNEL_PALETTE[k] ?? "var(--dlo-chart-muted)",
      }));

    return { bucketSlices, matterSlices, channelSlices };
  }, [inScope, lang, tx]);

  const total = inScope.length;
  if (total === 0) return null;

  return (
    <section className={styles.analytics} aria-label={tx("অফিসের বিশ্লেষণ", "Office analytics")}>
      <AnalyticsCard
        title={tx("কিউ গঠন", "Queue composition")}
        sub={tx("নতুন / যাচাই / সিদ্ধান্তের অনুপাত", "Split of new, in verification and decided")}
      >
        <div className={styles.compositionBody}>
          <QueueDonut slices={dataset.bucketSlices} total={total} />
          <Legend slices={dataset.bucketSlices} total={total} />
        </div>
      </AnalyticsCard>

      <AnalyticsCard
        title={tx("মামলার ধরন", "Matter categories")}
        sub={tx("কোন ধরনের সমস্যা বেশি আসছে", "Which issues are coming in most")}
      >
        <VerticalBars slices={dataset.matterSlices} total={total} />
      </AnalyticsCard>

      <AnalyticsCard
        title={tx("আবেদনের মাধ্যম", "Filing channel")}
        sub={tx("কোন দরজা দিয়ে মানুষ আসছে", "Which door people use to reach the office")}
      >
        <HorizontalBars slices={dataset.channelSlices} total={total} />
      </AnalyticsCard>
    </section>
  );
}
