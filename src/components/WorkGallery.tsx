"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Reveal from "./Reveal";
import styles from "./Work.module.css";

export type WorkImage = { src: string; alt: string; caption: string | null };

export default function WorkGallery({ images }: { images: WorkImage[] }) {
  const [active, setActive] = useState<number | null>(null);
  const isOpen = active !== null;

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (dir: -1 | 1) =>
      setActive((i) => (i === null ? i : (i + dir + images.length) % images.length)),
    [images.length]
  );

  // Keyboard navigation + lock body scroll while the lightbox is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, step]);

  const current = active !== null ? images[active] : null;

  return (
    <>
      <div className={styles.gallery}>
        {images.map((img, i) => (
          <Reveal key={img.src} delay={(i % 3) * 90} className={styles.tileReveal}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => setActive(i)}
              aria-label={`View photo: ${img.caption || img.alt}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className={styles.tileImg}
              />
              {img.caption && <span className={styles.cap}>{img.caption}</span>}
            </button>
          </Reveal>
        ))}
      </div>

      {isOpen && current && (
        <div
          className={styles.lb}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={close}
        >
          <button className={styles.lbClose} onClick={close} aria-label="Close">
            ✕
          </button>
          {images.length > 1 && (
            <button
              className={`${styles.lbNav} ${styles.lbPrev}`}
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}
          <figure className={styles.lbFig} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lbImgWrap}>
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="90vw"
                className={styles.lbImg}
                priority
              />
            </div>
            {current.caption && <figcaption className={styles.lbCap}>{current.caption}</figcaption>}
          </figure>
          {images.length > 1 && (
            <button
              className={`${styles.lbNav} ${styles.lbNext}`}
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              aria-label="Next photo"
            >
              ›
            </button>
          )}
          <span className={styles.lbCount}>
            {active + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  );
}
