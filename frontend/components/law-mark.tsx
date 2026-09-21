"use client";

import Image from "next/image";
import type { StaticImageData } from "next/image";
import styles from "./law-mark.module.css";

type LawMarkProps = {
  image: StaticImageData;
};

export function LawMark({ image }: LawMarkProps) {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <Image
        className={styles.image}
        style={{ objectFit: "cover" }}
        src={image}
        alt="Justice symbol"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 55vw"
      />
      <div className={styles.vignette} />
      <div className={styles.grid} />
    </div>
  );
}