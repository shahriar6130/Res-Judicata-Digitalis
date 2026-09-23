"use client";

import { DebugConsole } from "./debug-console";
import { ApplyHeader, ClientOnly, styles, useTx } from "./shared";

export function DebugPage() {
  const { tx } = useTx();
  return (
    <main className={styles.page}>
      <ApplyHeader />
      <div className={styles.shell}>
        <p className={styles.eyebrow}>/debug · localStorage[&quot;dlas.db.v1&quot;]</p>
        <h1 className={styles.title}>{tx("শেয়ার্ড রেকর্ড ডিবাগার", "Shared-record debugger")}</h1>
        <p className={styles.lead}>
          {tx(
            "প্রতিটি সেশন ও আবেদন কোন ধাপে আছে, তার সম্পূর্ণ JSON, প্রতিটি ফিল্ডের উৎস, অডিট, তৈরি হওয়া কাজ ও সিমুলেটেড বার্তা। অন্য ট্যাবে কোনো দরজা খোলা রাখলে এখানে সরাসরি আপডেট হবে।",
            "Where every session and application is, its full JSON, per-field provenance, audit, tasks created and simulated messages. Keep any door open in another tab and this updates live.",
          )}
        </p>
        <ClientOnly>
          <DebugConsole />
        </ClientOnly>
      </div>
    </main>
  );
}
