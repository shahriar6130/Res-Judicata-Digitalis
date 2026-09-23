"use client";

/* /device — the two screenless doors: IVR 16699 and USSD *16699#. */

import Link from "next/link";
import { ScriptedPhone } from "./scripted-phone";
import { ApplyHeader, ClientOnly, SimTag, styles, useTx } from "./shared";

export function DevicePage({ mode }: { mode: "ivr" | "ussd" }) {
  const { tx } = useTx();
  return (
    <main className={styles.page}>
      <ApplyHeader />
      <div className={styles.shell}>
        <p className={styles.eyebrow}>{tx("প্রবেশ ও আবেদন · ফোন দরজা", "Access & application · phone doors")}</p>
        <h1 className={styles.title}>{mode === "ivr" ? tx("১৬৬৯৯ আইভিআর / ভয়েস", "16699 IVR / voice") : tx("ইউএসএসডি *16699#", "USSD *16699#")}</h1>
        <div className={styles.chips} style={{ marginBottom: "var(--s-4)" }}>
          <Link href="/device/ivr" className={styles.chip} aria-pressed={mode === "ivr"}>
            IVR 16699
          </Link>
          <Link href="/device/ussd" className={styles.chip} aria-pressed={mode === "ussd"}>
            USSD *16699#
          </Link>
        </div>
        <p className={styles.lead}>
          {mode === "ivr"
            ? tx(
                "যাঁরা পড়তে পারেন না বা দেখতে পান না: শুনে কীপ্যাড চাপুন বা কথা বলুন। প্রতিটি কথা পড়ে শোনানো ও নিশ্চিত করা হয়।",
                "For people who cannot read or see: listen, press keys or speak. Every spoken answer is read back and confirmed.",
              )
            : tx("বাটন ফোন, ডেটা ছাড়া: ছোট মেনু, সংখ্যা দিয়ে উত্তর। এসএমএসে কখনো 'আইনি সহায়তা' লেখা হয় না।", "Button phones, no data: short menus, answer with digits. SMS never says 'legal aid'.")}{" "}
          <SimTag>{mode === "ivr" ? tx("টেলিফোন নেটওয়ার্ক সিমুলেটেড", "Telephone network simulated") : tx("ইউএসএসডি গেটওয়ে সিমুলেটেড", "USSD gateway simulated")}</SimTag>
        </p>
        <ClientOnly>
          <ScriptedPhone key={mode} mode={mode === "ivr" ? "IVR" : "USSD"} />
        </ClientOnly>
      </div>
    </main>
  );
}
