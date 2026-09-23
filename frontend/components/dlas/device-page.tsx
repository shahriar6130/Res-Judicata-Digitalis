"use client";

/* /device — the two screenless doors: IVR 16699 and USSD *16699#. */

import Link from "next/link";
import { ScriptedPhone } from "./scripted-phone";
import { ApplyHeader, ClientOnly, SimTag, styles, useTx } from "./shared";
import ui from "./device-page.module.css";

export function DevicePage({ mode }: { mode: "ivr" | "ussd" }) {
  const { tx } = useTx();
  return (
    <main className={styles.page}>
      <ApplyHeader />
      <div className={`${styles.shell} ${ui.shell}`}>
        <header className={ui.intro}>
          <div className={ui.introCopy}>
            <p className={ui.eyebrow}>{tx("ফোনের মাধ্যমে আবেদন", "APPLY BY PHONE")} <span aria-hidden="true">/</span> {mode === "ivr" ? "01" : "02"}</p>
            <h1 className={ui.title}>{mode === "ivr" ? tx("শুনে বা বলে আবেদন করুন", "Apply by listening or speaking") : tx("ইন্টারনেট ছাড়াই আবেদন করুন", "Apply without internet")}</h1>
            <p className={ui.lead}>
              {mode === "ivr"
                ? tx("১৬৬৯৯-এ কলের অভিজ্ঞতা অনুশীলন করুন। প্রম্পট শুনুন, কীপ্যাড চাপুন বা কণ্ঠে উত্তর দিন।", "Try the 16699 call flow. Listen to prompts, press the keypad, or answer by voice.")
                : tx("*16699# মেনুর অভিজ্ঞতা অনুশীলন করুন। বাটন ফোনের মতো ছোট প্রশ্নের উত্তর লিখুন।", "Try the *16699# menu flow. Answer short questions as you would on a button phone.")}
            </p>
            <SimTag>{mode === "ivr" ? tx("টেলিফোন নেটওয়ার্ক সিমুলেটেড", "Telephone network simulated") : tx("ইউএসএসডি গেটওয়ে সিমুলেটেড", "USSD gateway simulated")}</SimTag>
          </div>
          <div className={ui.introGuide}>
            <span>{tx("এভাবে শুরু করুন", "GET STARTED")}</span>
            <ol>
              <li><b>01</b>{tx("নিজের সিম নম্বর দিন", "Enter your SIM number")}</li>
              <li><b>02</b>{mode === "ivr" ? tx("কল চাপুন", "Press Call") : tx("ডায়াল চাপুন", "Press Dial")}</li>
              <li><b>03</b>{mode === "ivr" ? tx("শুনে উত্তর দিন", "Listen and respond") : tx("মেনুর উত্তর দিন", "Reply to the menu")}</li>
            </ol>
          </div>
        </header>
        <nav className={ui.modeNav} aria-label={tx("ফোনের পদ্ধতি", "Phone method")}>
          <Link href="/device/ivr" className={mode === "ivr" ? ui.modeActive : ""} aria-current={mode === "ivr" ? "page" : undefined}>
            <span className={ui.modeNumber}>01</span><span><strong>{tx("ভয়েস কল", "Voice call")}</strong><small>IVR · 16699</small></span><span aria-hidden="true">↗</span>
          </Link>
          <Link href="/device/ussd" className={mode === "ussd" ? ui.modeActive : ""} aria-current={mode === "ussd" ? "page" : undefined}>
            <span className={ui.modeNumber}>02</span><span><strong>{tx("বাটন ফোন মেনু", "Button phone menu")}</strong><small>USSD · *16699#</small></span><span aria-hidden="true">↗</span>
          </Link>
        </nav>
        <div className={ui.workspaceHeading}>
          <div><span>{tx("সক্রিয় সিমুলেশন", "ACTIVE SIMULATION")}</span><h2>{mode === "ivr" ? tx("১৬৬৯৯ কল কর্মক্ষেত্র", "16699 call workspace") : tx("*16699# মেনু কর্মক্ষেত্র", "*16699# menu workspace")}</h2></div>
          <p>{tx("এখানে দেওয়া তথ্য একই আবেদন রেকর্ডে লেখা হয়।", "Answers here are written to the same application record.")}</p>
        </div>
        <ClientOnly>
          <ScriptedPhone key={mode} mode={mode === "ivr" ? "IVR" : "USSD"} />
        </ClientOnly>
      </div>
    </main>
  );
}
