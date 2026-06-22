import { stats } from "@/lib/site-config";
import Reveal from "./Reveal";
import styles from "./TrustBar.module.css";

export default function TrustBar() {
  return (
    <section className={styles.band}>
      <div className="hazard" aria-hidden />
      <div className={`container ${styles.grid}`}>
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className={styles.stat}>
            <span className={styles.value}>{s.value}</span>
            <span className={styles.label}>{s.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
