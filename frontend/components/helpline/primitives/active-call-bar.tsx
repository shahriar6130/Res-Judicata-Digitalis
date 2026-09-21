"use client";

import { ActiveCallBarService, useHelplineStore } from "@/lib/shakkho";
import { Mic, MicOff, Play, AlertCircle, ChevronRight, Phone } from "@/components/icons";
import styles from "../helpline.module.css";

/* Persistent floating call bar — visible on every helpline page so the
 * agent always knows the current call state. Renders nothing when no
 * call is in progress. */
export function ActiveCallBar() {
  const envelope = useHelplineStore();
  const bar = envelope.activeCallBar;
  if (!bar) return null;
  return (
    <div className={styles.callBar} role="status" aria-live="polite">
      <div className={styles.callBarLeft}>
        <Phone size={18} aria-hidden />
        <div>
          <strong>{bar.callerName}</strong>
          <span>{bar.applicantName ?? bar.sessionId}</span>
        </div>
      </div>
      <div className={styles.callBarMid}>
        {bar.urgent ? (
          <span className={styles.callBarUrgent}>
            <AlertCircle size={14} aria-hidden /> Urgent
          </span>
        ) : null}
        <span className={styles.callBarChannel}>{bar.route ?? "ai"}</span>
      </div>
      <div className={styles.callBarRight}>
        <button
          type="button"
          className={styles.callBarBtn}
          onClick={() => ActiveCallBarService.toggleHold()}
          aria-label={bar.onHold ? "Resume" : "Hold"}
        >
          {bar.onHold ? <Play size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        </button>
        <button
          type="button"
          className={styles.callBarBtn}
          onClick={() => ActiveCallBarService.toggleMute()}
          aria-label={bar.muted ? "Unmute" : "Mute"}
        >
          {bar.muted ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
        </button>
        <button
          type="button"
          className={`${styles.callBarBtn} ${styles.callBarBtnDanger}`}
          onClick={() => ActiveCallBarService.end()}
          aria-label="End call"
        >
          <AlertCircle size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
