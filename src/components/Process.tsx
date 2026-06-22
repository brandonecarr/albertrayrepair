import { processSteps } from "@/lib/site-config";
import Reveal from "./Reveal";
import { ArrowIcon } from "./Icons";
import styles from "./Process.module.css";

export default function Process() {
  return (
    <section id="process" className={`section section--ink grain ${styles.section}`}>
      <div className={`tex-grid--ink ${styles.grid}`} aria-hidden />
      <div className="container">
        <div className={styles.head}>
          <Reveal as="p" className="eyebrow eyebrow--center">
            How It Works
          </Reveal>
          <Reveal as="h2" className="h-lg" delay={60}>
            Booked in <span className="accent">three steps.</span>
          </Reveal>
        </div>

        <ol className={styles.steps}>
          {processSteps.map((s, i) => (
            <Reveal as="li" key={s.step} delay={i * 110} className={styles.step}>
              <span className={styles.num}>{s.step}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepBody}>{s.body}</p>
              {i < processSteps.length - 1 && (
                <ArrowIcon className={styles.connector} aria-hidden />
              )}
            </Reveal>
          ))}
        </ol>

        <Reveal className={styles.cta} delay={120}>
          <a href="#booking" className="btn btn--lg btn--on-ink">
            Start Step One
            <ArrowIcon />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
