"use client";

import Image from "next/image";
import styles from "./law-mark.module.css";
import justiceImage from "@/assets/justice-stands-strong-stockcake.jpg";

export function LawMark() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <Image
        className={styles.image}
        src={justiceImage}
        alt=""
        fill
        priority
        sizes="50vw"
      />
      <div className={styles.grid} />
    </div>
  );
}