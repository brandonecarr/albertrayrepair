import { IchthysIcon } from "./Icons";
import Reveal from "./Reveal";
import styles from "./Faith.module.css";

export default function Faith() {
  return (
    <section id="faith" className={`section section--ink ${styles.section}`}>
      <div className="hazard" aria-hidden />
      <div className={`container ${styles.inner}`}>
        <Reveal className={styles.mark}>
          <IchthysIcon className={styles.fish} />
        </Reveal>

        <Reveal as="p" className="eyebrow eyebrow--center" delay={60}>
          Faith &amp; Integrity
        </Reveal>

        <Reveal as="blockquote" className={styles.verse} delay={120}>
          &ldquo;And whatsoever ye do, do it heartily, as to the Lord, and not
          unto men.&rdquo;
        </Reveal>

        <Reveal as="p" className={styles.cite} delay={180}>
          Colossians 3:23
        </Reveal>

        <Reveal as="p" className={styles.statement} delay={240}>
          Albert is a man of faith, and he runs his business the way he lives his
          life&mdash;with honesty, a hard day&rsquo;s work, and respect for every
          person and every home he&rsquo;s trusted to care for.
        </Reveal>
      </div>
    </section>
  );
}
