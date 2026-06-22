import { testimonials } from "@/lib/site-config";
import { StarIcon } from "./Icons";
import Reveal from "./Reveal";
import styles from "./Testimonials.module.css";

export default function Testimonials() {
  return (
    <section id="reviews" className={`section ${styles.section}`}>
      <div className="container">
        <div className={styles.head}>
          <Reveal as="p" className="eyebrow">
            From The Neighborhood
          </Reveal>
          <Reveal as="h2" className="h-lg" delay={60}>
            Work that earns <span className="accent">repeat calls.</span>
          </Reveal>
        </div>

        <div className={styles.grid}>
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 100} className={styles.card}>
              <div className={styles.stars} aria-label="5 out of 5 stars">
                <StarIcon /> <StarIcon /> <StarIcon /> <StarIcon /> <StarIcon />
              </div>
              <blockquote className={styles.quote}>&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className={styles.who}>
                <span className={styles.name}>{t.name}</span>
                <span className={styles.detail}>{t.detail}</span>
              </figcaption>
              <span className={styles.mark} aria-hidden>
                &rdquo;
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
