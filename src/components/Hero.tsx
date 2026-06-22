import { site } from "@/lib/site-config";
import { ShieldIcon } from "./Icons";
import LeadForm from "./LeadForm";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section id="top" className={`section--ink grain ${styles.hero}`}>
      <div className={`tex-grid--ink ${styles.gridLayer}`} aria-hidden />
      <div className={styles.glow} aria-hidden />

      <div className={`container ${styles.inner}`}>
        <div className={styles.content}>
          <p className={`eyebrow rise ${styles.eyebrow}`} style={{ ["--rise-delay" as string]: "60ms" }}>
            Inland Empire&rsquo;s Repair &amp; Restoration Pro
          </p>

          <h1 className={`h-xl ${styles.title} rise`} style={{ ["--rise-delay" as string]: "140ms" }}>
            <span className={styles.titleSm}>No job too small.</span>
            <span className={`accent ${styles.titleLg}`}>Done right</span>
            <span className={styles.titleSm}>the first time.</span>
          </h1>

          <ul className={`${styles.badges} rise`} style={{ ["--rise-delay" as string]: "220ms" }}>
            {site.badges.map((b) => (
              <li key={b} className={styles.badge}>
                <ShieldIcon className={styles.badgeIcon} />
                {b}
              </li>
            ))}
          </ul>

          <p className={`lead ${styles.lead} rise`} style={{ ["--rise-delay" as string]: "300ms" }}>
            {site.description}
          </p>
        </div>

        <div className={`${styles.formWrap} rise`} style={{ ["--rise-delay" as string]: "260ms" }}>
          <LeadForm
            variant="hero"
            title="Get Your Free Estimate"
            subtitle="Tell us about the job and Albert will get right back to you — usually within the hour."
            cta="Request Free Estimate"
          />
        </div>
      </div>
    </section>
  );
}
