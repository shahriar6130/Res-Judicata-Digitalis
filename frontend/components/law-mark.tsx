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
        style={{ objectFit: "contain" }}
        src={image}
        alt=""
        fill
        priority
        sizes="50vw"
      />
      <div className={styles.grid} />
    </div>
  );
}